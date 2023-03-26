import { Octokit } from "https://cdn.skypack.dev/@octokit/rest";
import { Grid, html } from "https://unpkg.com/gridjs?module";

import repos from "./repos.json" assert { type: "json" };
import authors from "./authors.json" assert { type: "json" };

const octokit = new Octokit();

window.onload = () => onLoad();
window.updateSearch = updateSearch;

async function onLoad() {
	const prs = await getPullRequests(repos, authors);
	new Grid({
		columns: [
			{ name: "Author", attributes: colorBasedOnStatus, formatter: (_, row) => searchableCell(row.cells[0].data) },
			{ name: "Repository", attributes: colorBasedOnStatus, formatter: (_, row) => searchableCell(row.cells[1].data) },
			{ name: "Review Status", attributes: colorBasedOnStatus, formatter: reviewStatusCell },
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
}

function updateSearch(value) {
	let searchInput = document.querySelector('.gridjs-search-input');
	searchInput.value = value;
	searchInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
}

function searchableCell(value) {
	return html(`<a href="javascript:updateSearch('${value}')"><img src='search.png' height='15px'/></a> ${value}`);
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

async function wait(millis) {
	return new Promise((resolve) => {
		setTimeout(() => resolve(), millis);
	});
}

function reviewStatusCell(cell, row) {
	const statusToClassMap = {
		reviewed: 'bg-success',
		'review requested': 'bg-warning',
		'n/a': 'bg-secondary',
		unreviewed: 'bg-info'
	}
	return html(`<span class="badge ${statusToClassMap[cell]}">${cell}</span>`);
}

function colorBasedOnStatus(cell, row) {
	let statusToColorMap = {
		reviewed: 'reviewed',
		'review requested': 'requested',
		'n/a': 'missing',
		unreviewed: 'unreviewed'
	}
	if(row) {
		return { class: statusToColorMap[row.cells[2].data] };
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

function getReviewStatus(pr) {
	if(getUrl(pr) === '<missing>') {
		return 'n/a';
	} else if(doesLabelExist(pr, 'reviewed')) {
		return 'reviewed';
	} else if(doesLabelExist(pr, 'review requested')) {
		return 'review requested';
	} else {
		return 'unreviewed';
	}
}

function buildGridOuput(repos, authors, prs) {
	return repos.flatMap(repo => 
		authors.map(author => {
			let prForRepoAndAuthor = prs.find(pr => pr.user.login === author.githubUser && getRepo(pr) === repo);
			return {
				author: author.name,
				repository: repo.split('/')[1],
				reviewStatus: getReviewStatus(prForRepoAndAuthor),
				reviewRequested: doesLabelExist(prForRepoAndAuthor, 'review requested').toString(),
				reviewed: doesLabelExist(prForRepoAndAuthor, 'reviewed').toString(),
				link: getUrl(prForRepoAndAuthor)
			};
		})
	).sort((a, b) => a.reviewStatus === 'review requested' ? -1 : 1);
}
