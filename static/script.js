import { Octokit } from "https://cdn.skypack.dev/@octokit/rest";
import { Grid, html } from "https://unpkg.com/gridjs?module";

import repos from "./repos.json" assert { type: "json" };
import authors from "./authors.json" assert { type: "json" };

const octokit = new Octokit();

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

async function wait(millis) {
	return new Promise((resolve) => {
		setTimeout(() => resolve(), millis);
	});
}

getPullRequests(repos, authors).then(prs => {
	new Grid({
		columns: [
			{ name: "Author", attributes: colorBasedOnStatus },
			{ name: "Repository", attributes: colorBasedOnStatus },
			{ name: "Review Requested", attributes: colorBasedOnStatus },
			{ name: "Reviewed", attributes: colorBasedOnStatus },
			{ name: "Link", attributes: colorBasedOnStatus }
		],
		data: buildGridOuput(repos, authors, prs),
		sort: true,
		search: true,
		style: {
			th: {
				background: '#212529',
				color: 'white'
			}
		}
	}).render(document.getElementById('pull-requests'));
});

function colorBasedOnStatus(cell, row) {
	if(row) {
		if(row.cells[4].data === '<missing>') {
			return { class: 'missing' };
		} else if(row.cells[3].data === 'true') {
			return { class: 'reviewed' };
		} else if(row.cells[2].data === 'true') {
			return { class: 'requested' };
		} else {
			return { class: 'unreviewed' };
		}
	}
}

function getRepo(pr) {
	let components = pr.repository_url.split("/");
	return `${components[components.length - 2]}/${components[components.length - 1]}`;
}

function getUrl(pr) {
	return pr ? html(`<a href='${pr.html_url}' target='_blank' rel='noopener noreferrer'>Link</a>`) : "<missing>";
}

function doesLabelExist(pr, label) {
	return (pr ? pr.labels.some((l) => l.name === label) : false);
}

function buildGridOuput(repos, authors, prs) {
	return repos.flatMap(repo => 
		authors.map(author => {
			let prForRepoAndAuthor = prs.find(pr => pr.user.login === author.githubUser && getRepo(pr) === repo);
			return {
				author: author.name,
				repository: repo.split('/')[1],
				reviewRequested: doesLabelExist(prForRepoAndAuthor, 'review requested').toString(),
				reviewed: doesLabelExist(prForRepoAndAuthor, 'reviewed').toString(),
				link: getUrl(prForRepoAndAuthor)
			};
		})
	).sort((a, b) => a.reviewRequested === 'true' && a.reviewed === 'false' ? -1 : 1);
}