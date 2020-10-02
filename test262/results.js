"use strict";
(function () {
  let test262_info = null;
  let latest = {};
  let formatter = new Intl.NumberFormat("en-GB");

  // Load test262 information:
  fetch("/test262/info.json")
    .then((response) => response.json())
    .then((data) => (test262_info = data));

  // Load latest complete data from master:
  fetch("/test262/refs/heads/master/latest.json")
    .then((response) => response.json())
    .then((data) => {
      latest.master = data;

      let container = document.getElementById("master-latest");
      container.appendChild(infoLink("master"));
    });

  // Load master branch information over time:
  fetch("/test262/refs/heads/master/results.json")
    .then((response) => response.json())
    .then((data) => {
      let info = createGeneralInfo(data);

      let container = document.getElementById("master-latest");
      container.innerHTML = "<h2><code>master</code> branch results:</h2>";

      container.appendChild(info);

      if (typeof latest.master !== "undefined") {
        container.appendChild(infoLink("master"));
      }

      container.style = "";

      // TODO: paint the graph with historical data.
    });

  // Tags/releases information.
  fetch("https://api.github.com/repos/boa-dev/boa/releases")
    .then((response) => response.json())
    .then((data) => {

      let latestTag = data[0].tag_name;

      // We set the latest version.
      fetch(`/test262/refs/tags/${getRefTag(latestTag)[1]}/results.json`)
        .then((response) => response.json())
        .then((data) => {
          let info = createGeneralInfo(data);

          let container = document.getElementById("version-latest");
          container.innerHTML = `<h2>Latest version (${latestTag}) results:</h2>`;

          container.appendChild(info);

          if (typeof latest[latestTag] !== "undefined") {
            container.appendChild(infoLink("master"));
          }

          container.style = "";
        });

      for (let rel of data) {
        let [version, tag] = getRefTag(rel.tag_name);

        if (version[0] == "v0" && parseInt(version[1]) < 10) {
          // We know there is no data for versions lower than v0.10.
          continue;
        }

        fetch(`/test262/refs/tags/${tag}/latest.json`)
          .then((response) => response.json())
          .then((data) => {
            latest[rel.tag_name] = data;

            if (rel.tag_name == latestTag) {
              let container = document.getElementById("version-latest");
              container.appendChild(infoLink(rel.tag_name));
            }

            // TODO: add version history.
          });
      }
    });

  // Creates a link to show the information about a particular tag / branch
  function infoLink(tag) {
    let div = document.createElement("div");
    let link = document.createElement("a");

    link.innerHTML = "Show information";
    link.href = "#";
    link.addEventListener("click", () => {
      let data = latest[tag];
      showData(data);
    });

    div.appendChild(link);
    return div;
  }

  // Shows the full test data.
  function showData(data) {
    console.log(data);

    let infoContainer = document.getElementById("info");
    infoContainer.innerHTML = "";

    let suites = document.createElement("ul");
    for (let suite of data.results.suites) {
      addSuite(suites, suite);
    }

    infoContainer.appendChild(suites);
    infoContainer.style = "";

    // Adds a suite representation to an element.
    function addSuite(elm, suite) {
      let li = document.createElement("li");
      let res = suite.results;

      // Add overal information:
      let info = document.createElement("div");

      let name = document.createElement("span");
      name.class = "name";
      name.innerHTML = suite.name;
      info.appendChild(name);

      let testData = document.createElement("span");
      testData.class = "data-overview";
      let dataHTML = ` <span class="passed-tests">${formatter.format(
        suite.passed
      )}</span>`;
      dataHTML += ` / <span class="ignored-tests">${formatter.format(
        suite.ignored
      )}</span>`;
      dataHTML += ` / <span class="failed-tests">${formatter.format(
        suite.total - suite.passed - suite.ignored
      )}</span>`;
      dataHTML += ` / <span class="total-tests">${formatter.format(
        suite.total
      )}</span>`;
      testData.innerHTML = dataHTML;
      info.appendChild(testData);

      li.appendChild(info);

      if (typeof suite.suites !== "undefined") {
        let inner = document.createElement("ul");
        for (let innerSuite of suite.suites) {
          addSuite(inner, innerSuite);
        }
        li.appendChild(inner);
      }

      elm.appendChild(li);
    }
  }

  /// Creates the general information structure.
  function createGeneralInfo(data) {
    let ul = document.createElement("ul");
    let latest = data[data.length - 1];

    let latestCommit = document.createElement("li");
    latestCommit.innerHTML = `Latest commit: <a href="https://github.com/boa-dev/boa/commit/${latest.commit}" title="Check commit">${latest.commit}</a>`;
    ul.appendChild(latestCommit);

    let totalTests = document.createElement("li");
    totalTests.innerHTML = `Total tests: <span class="total-tests">${formatter.format(
        latest.total
      )}</span>`;
    ul.appendChild(totalTests);

    let passedTests = document.createElement("li");
    passedTests.innerHTML = `Passed tests: <span class="passed-tests">${formatter.format(
        latest.passed
      )}</span>`;
    ul.appendChild(passedTests);

    let ignoredTests = document.createElement("li");
    ignoredTests.innerHTML = `Ignored tests: <span class="ignored-tests">${formatter.format(
        latest.ignored
      )}</span>`;
    ul.appendChild(ignoredTests);

    let failedTests = document.createElement("li");
    failedTests.innerHTML = `Failed tests: <span class="failed-tests">${formatter.format(
        latest.total - latest.passed - latest.ignored
      )}</span>`;
    ul.appendChild(failedTests);

    let conformance = document.createElement("li");
    conformance.innerHTML = `Conformance: <b>${
        Math.round((10000 * latest.passed) / latest.total) / 100
      }%</b>`;
    ul.appendChild(conformance);

    return ul;
  }

  function getRefTag(tag) {
    let version = tag.split(".");

    // Seems that refs are stored with an ending 0:
    if (version.length == 2) {
      tag += ".0";
    }

    return [version, tag]
  }
})();
