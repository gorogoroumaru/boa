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

      let container = $("#master-latest");
      container.append(infoLink("master"));
    });

  // Load master branch information over time:
  fetch("/test262/refs/heads/master/results.json")
    .then((response) => response.json())
    .then((data) => {
      let info = createGeneralInfo(data);

      let container = $("#master-latest");
      container.html("<h2><code>master</code> branch results:</h2>");

      container.append(info);

      if (typeof latest.master !== "undefined") {
        container.append(infoLink("master"));
      }

      container.show(400);

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

          let container = $("#version-latest");
          container.html(`<h2>Latest version (${latestTag}) results:</h2>`);

          container.append(info);

          if (typeof latest[latestTag] !== "undefined") {
            container.append(infoLink(latestTag));
          }

          container.show(400);
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
              let container = $("#version-latest");
              container.append(infoLink(rel.tag_name));
            }

            // TODO: add version history.
          });
      }
    });

  // Creates a link to show the information about a particular tag / branch
  function infoLink(tag) {
    let div = $("<div></div>");
    let link = $("<a></a>");

    link.text("Show information");
    link.attr("href", "#");
    link.click(() => {
      let data = latest[tag];
      showData(data);
    });

    div.append(link);
    return div;
  }

  // Shows the full test data.
  function showData(data) {
    let infoContainer = $("#info");
    infoContainer.hide(800);
    infoContainer.html("");

    for (let suite of data.results.suites) {
      addSuite(infoContainer, suite, "info");
    }

    infoContainer.show(800);

    // Adds a suite representation to an element.
    function addSuite(elm, suite, parentID) {
      let li = $("<div></div>");
      li.addClass("card");

      let newID = parentID + suite.name;

      let header = $("<div></div>");
      let headerID = newID + "header";
      header.attr("id", headerID).addClass("card-header").addClass("col-md-12");

      // Add overal information:
      let info = $("<button></button>");
      info
        .addClass("btn")
        .addClass("btn-light")
        .addClass("btn-block")
        .addClass("text-left")
        .attr("type", "button")
        .attr("data-toggle", "collapse");

      let name = $("<span></span>");
      name.addClass("name").text(suite.name);
      info.append(name).attr("aria-expanded", false);

      let testData = $("<span></span>");
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
      testData.addClass("data-overview").html(dataHTML);
      info.append(testData);

      header.append(info);
      li.append(header);

      if (typeof suite.suites !== "undefined") {
        let inner = $("<div></div>")
          .attr("id", newID)
          .attr("data-parent", "#" + parentID)
          .addClass("collapse")
          .attr("aria-labelledby", headerID);

        let innerInner = $("<div></div>")
          .addClass("card-body")
          .addClass("accordion");

        for (let innerSuite of suite.suites) {
          addSuite(innerInner, innerSuite, newID);
          info.attr("aria-controls", newID).attr("data-target", "#" + newID);
        }
        inner.append(innerInner);
        li.append(inner);
      }

      elm.append(li);
    }
  }

  /// Creates the general information structure.
  function createGeneralInfo(data) {
    let ul = $("<ul></ul>");
    let latest = data[data.length - 1];

    let latestCommit = $("<li></li>");
    latestCommit.html(
      `Latest commit: <a href="https://github.com/boa-dev/boa/commit/${latest.commit}" title="Check commit">${latest.commit}</a>`
    );
    ul.append(latestCommit);

    let totalTests = $("<li></li>");
    totalTests.html(
      `Total tests: <span class="total-tests">${formatter.format(
        latest.total
      )}</span>`
    );
    ul.append(totalTests);

    let passedTests = $("<li></li>");
    passedTests.html(
      `Passed tests: <span class="passed-tests">${formatter.format(
        latest.passed
      )}</span>`
    );
    ul.append(passedTests);

    let ignoredTests = $("<li></li>");
    ignoredTests.html(
      `Ignored tests: <span class="ignored-tests">${formatter.format(
        latest.ignored
      )}</span>`
    );
    ul.append(ignoredTests);

    let failedTests = $("<li></li>");
    failedTests.html(
      `Failed tests: <span class="failed-tests">${formatter.format(
        latest.total - latest.passed - latest.ignored
      )}</span>`
    );
    ul.append(failedTests);

    let conformance = $("<li></li>");
    conformance.html(
      `Conformance: <b>${
        Math.round((10000 * latest.passed) / latest.total) / 100
      }%</b>`
    );
    ul.append(conformance);

    return ul;
  }

  function getRefTag(tag) {
    let version = tag.split(".");

    // Seems that refs are stored with an ending 0:
    if (version.length == 2) {
      tag += ".0";
    }

    return [version, tag];
  }
})();
