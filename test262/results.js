"use strict";
(function () {
  let test262Info = null;
  let latest = {};
  let formatter = new Intl.NumberFormat("en-GB");

  // Load test262 information:
  fetch("/test262/info.json")
    .then((response) => response.json())
    .then((data) => (test262Info = data));

  // Load latest complete data from master:
  fetch("/test262/refs/heads/master/latest.json")
    .then((response) => response.json())
    .then((data) => {
      latest.master = data;

      let container = $("#master-latest .card-body");
      container.append(infoLink("master"));
    });

  // Load master branch information over time:
  fetch("/test262/refs/heads/master/results.json")
    .then((response) => response.json())
    .then((data) => {
      let innerContainer = $("<div></div>")
        .addClass("card-body")
        .append($("<h2><code>master</code> branch results:</h2>"))
        .append(createGeneralInfo(data));

      if (typeof latest.master !== "undefined") {
        innerContainer.append(infoLink("master"));
      }

      $("#master-latest")
        .append($("<div></div>").addClass("card").append(innerContainer))
        .show();

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
          let innerContainer = $("<div></div>")
            .addClass("card-body")
            .append($(`<h2>Latest version (${latestTag}) results:</h2>`))
            .append(createGeneralInfo(data));

          if (typeof latest[latestTag] !== "undefined") {
            innerContainer.append(infoLink(latestTag));
          }

          $("#version-latest")
            .append($("<div></div>").addClass("card").append(innerContainer))
            .show();
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
              let container = $("#version-latest .card-body");
              container.append(infoLink(rel.tag_name));
            }

            // TODO: add version history.
          });
      }
    });

  // Creates a link to show the information about a particular tag / branch
  function infoLink(tag) {
    return $("<div></div>")
      .addClass("info-link")
      .append(
        $("<a></a>") // Bootstrap info-square icon:https://icons.getbootstrap.com/icons/info-square/
          .append(
            `<svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-info-square" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" d="M14 1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
    <path fill-rule="evenodd" d="M14 1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
    <path d="M8.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588z"/>
    <circle cx="8" cy="4.5" r="1"/>
  </svg>`
          )
          .addClass("card-link")
          .attr("href", "#")
          .click(() => {
            let data = latest[tag];
            showData(data);
          })
      );
  }

  // Shows the full test data.
  function showData(data) {
    let infoContainer = $("#info");
    setTimeout(
      function () {
        infoContainer.html("");
        for (let suite of data.results.suites) {
          addSuite(infoContainer, suite, "info", "test/" + suite.name);
        }
        infoContainer.collapse("show");
      },
      infoContainer.hasClass("show") ? 500 : 0
    );
    infoContainer.collapse("hide");

    // Adds a suite representation to an element.
    function addSuite(elm, suite, parentID, namespace) {
      let li = $("<div></div>").addClass("card");

      let newID = parentID + suite.name;
      let headerID = newID + "header";
      let header = $("<div></div>")
        .attr("id", headerID)
        .addClass("card-header")
        .addClass("col-md-12");

      // Add overal information:
      let info = $("<button></button>")
        .addClass("btn")
        .addClass("btn-light")
        .addClass("btn-block")
        .addClass("text-left")
        .attr("type", "button")
        .attr("data-toggle", "collapse");

      let name = $("<span></span>").addClass("name").text(suite.name);
      info.append(name).attr("aria-expanded", false);

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
      info.append($("<span></span>").addClass("data-overview").html(dataHTML));

      header.append(info);
      li.append(header);

      // Add sub-suites

      let inner = $("<div></div>")
        .attr("id", newID)
        .attr("data-parent", "#" + parentID)
        .addClass("collapse")
        .attr("aria-labelledby", headerID);

      let innerInner = $("<div></div>")
        .addClass("card-body")
        .addClass("accordion");

      if (typeof suite.tests !== "undefined" && suite.tests.length !== 0) {
        let grid = $("<div></div>")
          .addClass("card-body")
          .append($("<h3>Direct tests:</h3>"));
        for (let innerTest of suite.tests) {
          let name = namespace + "/" + innerTest.name + ".js";
          grid.append(
            $("<div></div>")
              .addClass("card")
              .addClass("test")
              .addClass(innerTest.passed ? "bg-success" : "bg-danger")
              .addClass("embed-responsive")
              .addClass("embed-responsive-1by1")
              .click(() => {
                window.open(
                  "https://github.com/tc39/test262/blob/main/" + name
                );
              })
          );
        }

        innerInner.append($("<div></div>").addClass("card").append(grid));
      }

      if (typeof suite.suites !== "undefined" && suite.suites.length !== 0) {
        for (let innerSuite of suite.suites) {
          addSuite(
            innerInner,
            innerSuite,
            newID,
            namespace + "/" + innerSuite.name
          );
        }
      }

      info.attr("aria-controls", newID).attr("data-target", "#" + newID);
      inner.append(innerInner);
      li.append(inner);

      elm.append(li);
    }
  }

  // Displays test information in a modal.
  function displayTestModal(name) {
    fetch("https://raw.githubusercontent.com/tc39/test262/main/" + name)
      .then((response) => response.text())
      .then((code) => console.log(code));
    // console.log(test262Info[name]);
  }

  /// Creates the general information structure.
  function createGeneralInfo(data) {
    let latest = data[data.length - 1];
    return $("<ul></ul>")
      .addClass("list-group")
      .addClass("list-group-flush")
      .append(
        $("<li></li>")
          .addClass("list-group-item")
          .html(
            `Latest commit: <a href="https://github.com/boa-dev/boa/commit/${latest.commit}" title="Check commit">${latest.commit}</a>`
          )
      )
      .append(
        $("<li></li>")
          .addClass("list-group-item")
          .html(
            `Total tests: <span class="total-tests">${formatter.format(
              latest.total
            )}</span>`
          )
      )
      .append(
        $("<li></li>")
          .addClass("list-group-item")
          .html(
            `Passed tests: <span class="passed-tests">${formatter.format(
              latest.passed
            )}</span>`
          )
      )
      .append(
        $("<li></li>")
          .addClass("list-group-item")
          .html(
            `Ignored tests: <span class="ignored-tests">${formatter.format(
              latest.ignored
            )}</span>`
          )
      )
      .append(
        $("<li></li>")
          .addClass("list-group-item")
          .html(
            `Failed tests: <span class="failed-tests">${formatter.format(
              latest.total - latest.passed - latest.ignored
            )}</span>`
          )
      )
      .append(
        $("<li></li>")
          .addClass("list-group-item")
          .html(
            `Conformance: <b>${
              Math.round((10000 * latest.passed) / latest.total) / 100
            }%</b>`
          )
        // TODO: add progress bar
      );
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
