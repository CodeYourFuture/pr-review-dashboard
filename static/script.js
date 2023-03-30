import { Grid, html } from "https://unpkg.com/gridjs?module";

window.onload = () => onLoad();
window.updateSearch = updateSearch;

const reviewStatuses = {
	requested: '#FFF59D',
	unreviewed: '#90CAF9',
	reviewed: '#A5D6A7',
	missing: '#EF9A9A'
}

let gridData;
let grid;
let statusChart;

async function onLoad() {
	gridData = await getPullRequests();
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
		data: buildGridData(gridData),
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
			labels: Object.keys(reviewStatuses),
			datasets: [
				{
					label: "Status",
					data: getChartData(gridData),
					backgroundColor: Object.values(reviewStatuses),
					borderWidth: 1,
				},
			],
		},
		options: {
			maintainAspectRatio: false,
			responsive: true,
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

function buildGridData(prs) {
	return prs.map(pr => {
		if(pr.link !== '-') {
			pr.link = html(`<a href='${pr.html_url}' target='_blank' rel='noopener noreferrer'>Link</a>`);
		}
		return pr;
	})
}

function updateHeading(gridData) {
	Object.keys(reviewStatuses).forEach(status => {
		const capitalisedStatus = status.charAt(0).toUpperCase() + status.slice(1);
		document.getElementById(`${status}-number`).innerText = 
			`${gridData.filter(row => row.reviewStatus === status).length} ${capitalisedStatus}`;
	})
}

function getChartData(gridData) {
	return Object.keys(reviewStatuses)
		.map(status => gridData.filter(row => row.reviewStatus === status).length);
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

async function getPullRequests() {
	const response = await fetch('prs');
	return await response.json();
}

function reviewStatusCell(cell, row) {
	const statusToClassMap = {
		reviewed: "bg-success",
		requested: "bg-warning",
		missing: "bg-danger",
		unreviewed: "bg-info",
	};
	return html(`<a href="javascript:updateSearch('${cell}')"><img src='search.png' height='15px'/></a> <span class="badge ${statusToClassMap[cell]}">${cell}</span>`);
}

function colorBasedOnStatus(cell, row) {
	if (row) {
		return { class: row.cells[2].data };
	}
}
