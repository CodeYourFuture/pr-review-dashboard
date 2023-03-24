# PR Review Dashboard
Allows you to quickly view all pull requests for the specified repositories and authors, along with whether the pull request has been reviewed (based on the presence of a `reviewed` label) and whether a review has been requested (based on the presence of a `review requested` label).

## How to run
- Clone the repository
- Run `npm install` from the root of the repository
- Create a `repos.json` file in the static directory (will be git-ignored), and add the repositories for which you'd like to view pull requests (see the `example-repos.json` for an example of the file structure)
- Create a `authors.json` file in the static directory (will be git-ignored), and add the authors for which you'd like to view pull requests (see the `example-authors.json` for an example of the file structure)
- Run `npm start` and go to http://localhost:3000
