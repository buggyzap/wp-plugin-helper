#!/usr/bin/env node
const args = require("args-parser")(process.argv);
const { exec } = require("child_process");
const { zip } = require("zip-a-folder");
const rimraf = require("rimraf");
const fs = require("fs");
const chalk = require("chalk");
const replace = require("replace-in-file");
const { prompt } = require("enquirer");
const path = require("path");

const _error = chalk.keyword("red");
const _warning = chalk.keyword("orange");
const _success = chalk.keyword("green");
const _command = chalk.bgCyan.bold;

const showHelp = () => {
  const helpText = `

    ${chalk.bold.yellow("WHAT THIS PACKAGE DO")}

    This package let you to automate some plugin development things, like .zip production package creation and github release publishing.

    ${chalk.bold.yellow("GET STARTED")}

    Run ${_success(
      "npx wp-plugin-helper"
    )} without arguments to configure your instance

    ${chalk.bold.yellow("HOW TO USE")}

    ${_command(
      "npx wp-plugin-helper"
    )} => Create a basic configuration file by Wizard

    ${_command(
      'npx wp-plugin-helper create-package --version="1.0.0"'
    )} => Create a release of versions 1.0.0

    It changes the version in your main plugin file, create a new package inside ${_success(
      "releases"
    )} with version that you specified and publish them in a new release on your github repo.

    It checks the changelog version in CHANGELOG.md file before do that.

    ${chalk.bold.yellow("OPTIONAL PARAMETERS")}

    ${_command("--release-message")} => Add a message on github release

    ${_command("--skip-check")} => Skip the changelog check

    ${_command(
      "--git-release"
    )} => Create a Github Release, change it to false if you want to create only local .zip package. Default: true

    ${_command("--last")} => Get current plugin version

  `;
  console.log(helpText);
};

const createPackageZip = async (version) => {
  const module_name = await getModuleName();
  if (!fs.existsSync("./releases")) await fs.mkdir(`releases/`, () => null);
  if (!fs.existsSync("./releases/versions"))
    await fs.mkdir(`releases/versions`, () => null);
  if (!fs.existsSync("./releases/tmp_dir"))
    await fs.mkdir(`releases/tmp_dir`, () => null);
  await fs.mkdir(`releases/tmp_dir/${module_name}/tmp`, () => null);
  await fs.mkdir("releases/versions/" + version, () => null);
  await zip(
    "releases/tmp_dir/",
    `releases/versions/${version}/${module_name}.zip`
  );
  rimraf("releases/tmp_dir/*", () => console.log("Raw package deleted"));
};

const getLast = async () => {
  const changelog = await fs.readFileSync("./CHANGELOG.md", {
    encoding: "UTF8",
  });
  const last = changelog.match(new RegExp("## \\[(.*)\\] -.*"))[1];
  console.log(_success(`Current plugin version is: ${last}`));
};

const existChangelog = async (version) => {
  const changelog = await fs.readFileSync("./CHANGELOG.md", {
    encoding: "UTF8",
  });
  return new RegExp("## \\[" + version + "\\] -.*").test(changelog);
};

const pluginHasChangelog = () => {
  return fs.existsSync("./CHANGELOG.md");
};

const createPackage = async (version, message = "") => {
  const module_name = await getModuleName();
  const {
    github_username,
    github_repo,
    github_token,
    include_globes,
    exclude_globes,
    module_package_name,
  } = getConfig();
  if (!pluginHasChangelog()) {
    console.log(
      _error(
        "Plugin must have a CHANGELOG.md file accordingly to https://keepachangelog.com/en/1.0.0/ format"
      )
    );
    return;
  }
  if (!version) {
    console.log(_error("Specify a version release with --version"));
    return;
  }
  if (!args["skip-check"]) {
    const changelogExist = await existChangelog(version);
    if (!changelogExist) {
      console.log(
        _error(
          "You cannot create a new release before specify a new version in CHANGELOG.md"
        )
      );
      return;
    }
  }
  const release_to_git = args["git-release"] !== "false";
  console.log(`Creating... ${version}`);
  try {
    const options = {
      files: `./${module_name}.php`,
      from: [/\* @version .*/g, /\* Version: .*/g],
      to: ["* @version " + version, "* Version: " + version],
    };
    await replace(options);
  } catch (error) {
    console.error(_error("Error occurred:", error));
  }
  const copyArgs = include_globes.join(" ");
  const excludeArgs =
    exclude_globes.length > 0 ? `-e ${exclude_globes.join(" ")}` : "";
  exec(
    `npx copyfiles ${excludeArgs} ${copyArgs} releases/tmp_dir/${module_name}`,
    async () => {
      console.log("Tmp package created");
      await createPackageZip(version);
      if (release_to_git) {
        exec(
          `github-release upload \
          --owner ${github_username} \
          --repo ${github_repo} \
          --tag "v${version}" \
          --release-name "${module_name} v${version}" \
          --body "${message}" \
          --token "${github_token}" \
          ./releases/versions/${version}/${module_name}.zip`,
          () => console.log("Release created on Github")
        );
      }
    }
  );
};

const getModuleName = async () => {
  const dir = path.basename(path.resolve(process.cwd()));
  return dir;
};

const isDev = async () => {
  const dir = path.basename(path.resolve(process.cwd()));
  return dir === "wp-plugin-helper";
};

const configWizard = async () => {
  const module_name = await getModuleName();
  const response = await prompt([
    {
      type: "input",
      name: "github_username",
      message: "Github Username",
    },
    {
      type: "input",
      name: "github_repo",
      message: "Github Repository name",
    },
    {
      type: "input",
      name: "github_token",
      message:
        "If your repository is private, we need a Token to explicitly create releases, create a new token here https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token with full 'repo' access. Paste your token here",
    },
  ]);
  fs.writeFile(
    "wp-plugin-helper.config.js",
    `module.exports.config = {
  github_username: "${response.github_username}",
  github_repo: "${response.github_repo}",
  github_token: "${response.github_token}",
  include_globes: [],
  exclude_globes: [],
  module_name: "${module_name}.php",
  module_package_name: "${module_name}.zip"
};`,
    "utf8",
    () =>
      console.log(
        "Basic Configuration files created, please fill other informations like globe module files selection inside wp-plugin-helper.config.js"
      )
  );
};

const getConfig = () => {
  if (fs.existsSync("wp-plugin-helper.config.js")) {
    const { config } = require("../../wp-plugin-helper.config");
    return config;
  }
  return false;
};

const noArgs = async () => {
  const module_name = await getModuleName();
  if (!fs.existsSync(`${module_name}.php`) && !isDev()) {
    console.log(
      _error(
        `${module_name}.php doesn't exists, it seems that to you are not in a valid wordpress plugin root folder, please execute me inside your plugin folder`
      )
    );
    return;
  }
  const configExist = await fs.existsSync("./wp-plugin-helper.config.js", {
    encoding: "UTF8",
  });
  if (!configExist) {
    console.log(
      _warning("wp-plugin-helper.config.js doesn't exists, let's create it!")
    );
    configWizard();
    return;
  }
};

if (args.last) {
  getLast();
  return;
}

if (args["create-package"]) {
  const { version, "release-message": message } = args;
  createPackage(version, message);
  return;
}

if (args.help || args.h) {
  showHelp();
  return;
}

noArgs();
