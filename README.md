[![dependency - wp-plugin-helper](https://img.shields.io/badge/dependency-wp--plugin--helper-red?logo=npm&logoColor=white)](https://www.npmjs.com/package/wp-plugin-helper)

# What this package do

This package let you to automate some Wordpress plugin development things, like .zip production package creation and github release publishing.

## Get started

```bash
npx wp-plugin-helper
```

If you want to speed up npx process, run

```bash
npm i wp-plugin-helper
```

to get fastest access to node packages.

## How to use

Create a release of version 1.0.0

```bash
npx wp-plugin-helper create-package --version="1.0.0" --release-message="My first plugin release"
```

It changes the version in your main plugin file, create a new package inside **releases** with version that you specified and publish them in a new release on your github repo.

It checks the changelog version in CHANGELOG.md file before do that.

## Optional parameters

### Add a message on github release

```bash
--release-message
```

### Create a Github Release, change it to false if you want to create only local .zip package. Default: true

```bash
--git-release
```

### Get current plugin version

```bash
--last
```
