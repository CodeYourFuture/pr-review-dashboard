import express from "express";
import { Octokit } from "octokit";
import NodeCache from "node-cache";
import repos from "./static/repos.json" assert { type: "json" };
import authors from "./static/authors.json" assert { type: "json" };

const octokit = new Octokit();
const app = express();

const githubCache = new NodeCache({ checkperiod: 1, deleteOnExpire: false });
let populating = false;

const reviewStatuses = ['requested', 'unreviewed', 'reviewed', 'missing'];

app.use(express.static("static"));
app.get("/prs", async (req, res) => {
    res.json(githubCache.get('prs'));
});

async function getPrsAndPopulateCache(repos, authors) {
    if(!populating) {
        populating = true;
        console.log('Making GitHub request - ' + new Date().toLocaleString());
        const rawPrs = await getPullRequests(repos, authors);
        const prs = buildGridOuput(repos, authors, rawPrs);
        githubCache.set('prs', prs, 60);
        populating = false;
    }
}

async function getPullRequests(repos, authors) {
	const allPrs = [];
	const reposForSearch = repos.map((repo) => `repo:${repo}`).join(" ");
	const authorsForSearch = authors.map((author) => `author:${author.githubUser}`).join(" ");

	let response;
	let page = 1;
	do {
		response = await octokit.rest.search.issuesAndPullRequests({
			q: `is:open ${reposForSearch} ${authorsForSearch}`,
			per_page: 100,
			page,
		});
		allPrs.push(...response.data.items);
		page++;
		wait(100);
	} while (allPrs.length < response.data.total_count && page <= 5);

	return allPrs;
}

function buildGridOuput(repos, authors, prs) {
	return repos
		.flatMap((repo) =>
			authors.map((author) => {
				let prForRepoAndAuthor = prs.find((pr) => pr.user.login === author.githubUser && getRepo(pr) === repo);
				return {
					author: author.name,
					repository: repo.split("/")[1],
					reviewStatus: getReviewStatus(prForRepoAndAuthor),
					link: getUrl(prForRepoAndAuthor),
				};
			})
		)
		.sort((a, b) => reviewStatuses.indexOf(a.reviewStatus) - reviewStatuses.indexOf(b.reviewStatus));
}

async function wait(millis) {
	return new Promise((resolve) => {
		setTimeout(() => resolve(), millis);
	});
}

function getRepo(pr) {
	let components = pr.repository_url.split("/");
	return `${components[components.length - 2]}/${components[components.length - 1]}`;
}

function getReviewStatus(pr) {
	if (getUrl(pr) === "-") {
		return "missing";
	} else if (doesLabelExist(pr, "reviewed")) {
		return "reviewed";
	} else if (doesLabelExist(pr, "review requested")) {
		return "requested";
	} else {
		return "unreviewed";
	}
}

function getUrl(pr) {
	return pr ? pr.html_url : "-";
}

function doesLabelExist(pr, label) {
	return pr ? pr.labels.some((l) => l.name === label) : false;
}

githubCache.on('expired', async (key, value) => {
    if(key === 'prs') {
        await getPrsAndPopulateCache(repos, authors);
    }
});

app.listen(3000, async () => {
    await getPrsAndPopulateCache(repos, authors);
    console.log("Dashboard running on http://localhost:3000")
});
