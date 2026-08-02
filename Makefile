# Bump level passed to `npm version` by the release target. Defaults to a
# patch bump; override on the command line, e.g.:
#   make release VERSION=minor
# Accepts any `npm version` argument: major | minor | patch | premajor |
# preminor | prepatch | prerelease, or an explicit version like 1.4.2.
VERSION := patch

all: pretty test

test:
	npm test

pretty:
	npx prettier --write .

# Bump the version, commit, tag, and push. The tag push triggers the publish
# workflow (.github/workflows/publish.yml), which publishes to npm via Trusted
# Publisher. `npm version` makes the commit and the v-prefixed tag itself.
release:
	npm test
	npm version $(VERSION)
	git push --follow-tags
