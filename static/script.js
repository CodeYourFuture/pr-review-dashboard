import { Octokit } from "https://cdn.skypack.dev/@octokit/rest";
import { Grid, html } from "https://unpkg.com/gridjs?module";

import repos from "./repos.json" assert { type: "json" };
import authors from "./authors.json" assert { type: "json" };

const octokit = new Octokit();

window.onload = () => onLoad();
window.updateSearch = updateSearch;

let gridData;
let grid;
let statusChart;

async function onLoad() {
	const prs = await getPullRequests(repos, authors);
	gridData = buildGridOuput(repos, authors, prs);
	grid = new Grid({
		columns: [
			{
				name: "Author",
				attributes: colorBasedOnStatus,
				formatter: (_, row) => searchableCell(row.cells[0].data),
			},
			{
				name: "Repository",
				attributes: colorBasedOnStatus,
				formatter: (_, row) => searchableCell(row.cells[1].data),
			},
			{ name: "Review Status", attributes: colorBasedOnStatus, formatter: reviewStatusCell },
			{ name: "Link", attributes: colorBasedOnStatus },
		],
		data: gridData,
		sort: true,
		search: false,
		style: {
			th: {
				background: "#212529",
				color: "white",
			},
		},
	}).render(document.getElementById("pull-requests"));

	document.getElementById("search").addEventListener("input", (e) => performSearch(e.target.value));
	document.getElementById("clearSearch").addEventListener("click", (e) => {
		document.getElementById("search").value = '';
		performSearch("");
	});

	const ctx = document.getElementById("statusChart");

	statusChart = new Chart(ctx, {
		type: "doughnut",
		data: {
			labels: ["requested", "reviewed", "unreviewed", "missing"],
			datasets: [
				{
					label: "Status",
					data: getChartData(gridData),
					backgroundColor: [
						'#FFF59D',
						'#A5D6A7',
						'#90CAF9',
						'#EF9A9A'
					],
					borderWidth: 1,
				},
			],
		},
		options: {
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					enabled: false
				}
			}
		},
	});

	updateHeading(gridData);
}

function updateHeading(gridData) {
	document.getElementById('requests-number').innerText = gridData.filter(row => row.reviewStatus === 'review requested').length + ' Requests';
	document.getElementById('reviewed-number').innerText = gridData.filter(row => row.reviewStatus === 'reviewed').length + ' Reviewed';
	document.getElementById('unreviewed-number').innerText = gridData.filter(row => row.reviewStatus === 'unreviewed').length + ' Unreviewed';
	document.getElementById('missing-number').innerText = gridData.filter(row => row.reviewStatus === 'missing').length + ' Missing';
}

function getChartData(gridData) {
	return [
		gridData.filter(row => row.reviewStatus === 'review requested').length,
		gridData.filter(row => row.reviewStatus === 'reviewed').length,
		gridData.filter(row => row.reviewStatus === 'unreviewed').length,
		gridData.filter(row => row.reviewStatus === 'missing').length,
	];
}

function performSearch(value) {
	if (value) {
		let filteredData = gridData.filter(
			(row) =>
				row.reviewStatus.toLowerCase() === value.toLowerCase()
				|| row.author.toLowerCase().includes(value.toLowerCase())
				|| row.repository.toLowerCase().includes(value.toLowerCase())
		);
		grid.updateConfig({ data: filteredData }).forceRender();
		statusChart.data.datasets[0].data = getChartData(filteredData);
		statusChart.update();
		updateHeading(filteredData);
	} else {
		grid.updateConfig({ data: gridData }).forceRender();
		statusChart.data.datasets[0].data = getChartData(gridData);
		statusChart.update();
		updateHeading(gridData);
	}
}

function updateSearch(value) {
	let searchInput = document.getElementById("search");
	searchInput.value = value;
	searchInput.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
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
		reviewed: "bg-success",
		"review requested": "bg-warning",
		missing: "bg-danger",
		unreviewed: "bg-info",
	};
	return html(`<a href="javascript:updateSearch('${cell}')"><img src='search.png' height='15px'/></a> <span class="badge ${statusToClassMap[cell]}">${cell}</span>`);
}

function colorBasedOnStatus(cell, row) {
	let statusToColorMap = {
		reviewed: "reviewed",
		"review requested": "requested",
		missing: "missing",
		unreviewed: "unreviewed",
	};
	if (row) {
		return { class: statusToColorMap[row.cells[2].data] };
	}
}

function getRepo(pr) {
	let components = pr.repository_url.split("/");
	return `${components[components.length - 2]}/${components[components.length - 1]}`;
}

function getUrl(pr) {
	return pr ? html(`<a href='${pr.html_url}' target='_blank' rel='noopener noreferrer'>Link</a>`) : "-";
}

function doesLabelExist(pr, label) {
	return pr ? pr.labels.some((l) => l.name === label) : false;
}

function getReviewStatus(pr) {
	if (getUrl(pr) === "-") {
		return "missing";
	} else if (doesLabelExist(pr, "reviewed")) {
		return "reviewed";
	} else if (doesLabelExist(pr, "review requested")) {
		return "review requested";
	} else {
		return "unreviewed";
	}
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
					reviewRequested: doesLabelExist(prForRepoAndAuthor, "review requested").toString(),
					reviewed: doesLabelExist(prForRepoAndAuthor, "reviewed").toString(),
					link: getUrl(prForRepoAndAuthor),
				};
			})
		)
		.sort((a, b) => (a.reviewStatus === "review requested" ? -1 : 1));
}
