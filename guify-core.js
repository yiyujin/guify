(function (global) {
  const registry = global.guiRegistry || (global.guiRegistry = {});
  const reactiveSketchVars = new Set();
  const sketchVarStore = Object.create(null);
  const styleElementId = "guify-core-styles";

  function injectStyles() {
    if (!global.document) return;
    if (global.document.getElementById(styleElementId)) return;

    const style = global.document.createElement("style");
    style.id = styleElementId;
    style.textContent =
      "#guify-panel-root {" +
      "  position: fixed;" +
      "  top: 0;" +
      "  right: 0;" +
      "  z-index: 999;" +
      "  width: min(360px, 92vw);" +
      "  height: 100vh;" +
      "  box-sizing: border-box;" +
      "  padding: 10px;" +
      "  border-left: 1px solid #d6d6d6;" +
      "  border-bottom: 1px solid #d6d6d6;" +
      "  display: flex;" +
      "  flex-direction: column;" +
      "  gap: 10px;" +
      "  overflow: hidden;" +
      " font-family: sans-serif;" +
      "}" +
      "#guify-title {" +
      "  margin: 0;" +
      "  font-size: 18px;" +
      "  font-weight: 700;" +
      "  line-height: 1.2;" +
      "}" +
      "#active-gui-area {" +
      "  border: 1px solid #d6d6d6;" +
      "  border-radius: 8px;" +
      "  padding: 10px;" +
      "  background: #fafafa;" +
      "  position: sticky;" +
      "  top: 0;" +
      "  z-index: 2;" +
      "  flex: 0 0 auto;" +
      "  max-height: 42vh;" +
      "  overflow: auto;" +
      "}" +
      "#variable-list {" +
      "  flex: 1 1 auto;" +
      "  min-height: 0;" +
      "  overflow-y: auto;" +
      "  overflow-x: hidden;" +
      "  padding-right: 2px;" +
      "}" +
      ".variable-item {" +
      "  border: 1px solid #ddd;" +
      "  border-radius: 8px;" +
      "  padding: 10px;" +
      "  margin-bottom: 8px;" +
      "  background: #fff;" +
      "}" +
      ".variable-item label {" +
      "  margin-left: 8px;" +
      "  font-family: monospace;" +
      "  font-weight: 600;" +
      "}" +
      ".variable-meta {" +
      "  display: block;" +
      "  margin-top: 6px;" +
      "  color: #666;" +
      "  font-size: 12px;" +
      "}" +
      ".variable-details {" +
      "  margin-top: 8px;" +
      "}" +
      ".variable-details select, .variable-details input {" +
      "  display: block;" +
      "  width: 100%;" +
      "  box-sizing: border-box;" +
      "  margin-top: 6px;" +
      "  padding: 6px 8px;" +
      "  border: 1px solid #ccc;" +
      "  border-radius: 6px;" +
      "}" +
      ".gui-row {" +
      "  display: flex;" +
      "  align-items: center;" +
      "  gap: 10px;" +
      "  margin-bottom: 8px;" +
      "}" +
      ".gui-label {" +
      "  min-width: 110px;" +
      "  font-family: monospace;" +
      "}" +
      ".gui-val-text {" +
      "  font-size: 12px;" +
      "  color: #444;" +
      "}";

    global.document.head.appendChild(style);
  }

  function hasGlobalBinding(varName) {
    try {
      global.eval(varName);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readSketchVariable(varName) {
    if (hasGlobalBinding(varName)) {
      try {
        return global.eval(varName);
      } catch (error) {
      }
    }

    if (Object.prototype.hasOwnProperty.call(sketchVarStore, varName)) {
      return sketchVarStore[varName];
    }
    if (Object.prototype.hasOwnProperty.call(global, varName)) {
      return global[varName];
    }
    return undefined;
  }

  function writeSketchVariable(varName, nextValue) {
    sketchVarStore[varName] = nextValue;

    if (hasGlobalBinding(varName)) {
      try {
        global.__guifyTempValue__ = nextValue;
        global.eval(varName + " = __guifyTempValue__");
        delete global.__guifyTempValue__;
        return;
      } catch (error) {
        delete global.__guifyTempValue__;
      }
    }

    if (Object.prototype.hasOwnProperty.call(global, varName)) {
      global[varName] = nextValue;
    }
  }

  function extractDeclaredVariableNames(code) {
    const names = [];
    const regex = /(?:let|var|const)\s+(\w+)\s*=\s*[^;]+;/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      names.push(match[1]);
    }
    return names;
  }

  function parseVariableDefinitions(code) {
    const parsedVariables = [];
    const varRegex = /(?:let|var|const)\s+(\w+)\s*=\s*([^;]+);/g;
    let match;

    while ((match = varRegex.exec(code)) !== null) {
      const varName = match[1];
      const varValue = match[2].trim();
      const preferColorByName = isColorVariableName(varName);
      let type;
      let value;
      let guiType;
      let params;

      if (!isNaN(varValue) && varValue !== "") {
        type = "number";
        value = parseFloat(varValue);
        guiType = "slider";
        params = "0, 400, " + value + ", 1";
      } else if (varValue === "true" || varValue === "false") {
        type = "boolean";
        value = varValue === "true";
        guiType = "checkbox";
        params = String(value);
      } else if (varValue.startsWith('"') || varValue.startsWith("'") || varValue.startsWith("#")) {
        const rawStringValue = varValue.replace(/[\'\"]/g, "");
        type = "string";
        value = rawStringValue;
        guiType = (preferColorByName || isLikelyColorLiteral(rawStringValue)) ? "color" : "text";
        params = varValue;
      } else if (preferColorByName) {
        // If a variable name suggests color, still expose a control even when the literal is unusual.
        type = "string";
        value = varValue.replace(/[\'\"]/g, "");
        guiType = "color";
        params = varValue.startsWith('"') || varValue.startsWith("'") ? varValue : '"' + value + '"';
      } else {
        continue;
      }

      parsedVariables.push({
        name: varName,
        type: type,
        value: value,
        selected: true,
        guiType: guiType,
        params: params
      });
    }

    return parsedVariables;
  }

  function readControlValue(control) {
    if (!control) return control;
    if (control.elt && control.elt.type === "checkbox" && typeof control.checked === "function") {
      return control.checked();
    }
    return typeof control.value === "function" ? control.value() : control;
  }

  function writeControlValue(control, nextValue) {
    if (!control) return;
    if (control.elt && control.elt.type === "checkbox" && typeof control.checked === "function") {
      control.checked(Boolean(nextValue));
      return;
    }
    if (typeof control.value === "function") {
      control.value(nextValue);
    }
  }

  function setupReactiveSketchGlobals(code) {
    const names = extractDeclaredVariableNames(code);
    names.forEach(function (varName) {
      if (reactiveSketchVars.has(varName)) return;
      sketchVarStore[varName] = readSketchVariable(varName);
      reactiveSketchVars.add(varName);
    });
  }

  function createControl(guiType, params) {
    const normalized = String(guiType || "").toLowerCase();
    switch (normalized) {
      case "slider":
        return createSlider.apply(null, params);
      case "color":
      case "colorpicker":
        try {
          return createColorPicker.apply(null, params);
        } catch (error) {
          return createInput(String(params && params[0] !== undefined ? params[0] : ""));
        }
      case "checkbox":
        return createCheckbox("", params[0] === true);
      case "text":
        return createInput(String(params && params[0] !== undefined ? params[0] : ""));
      default:
        throw new Error("Unsupported GUI type: " + guiType);
    }
  }

  function isLikelyColorLiteral(value) {
    if (typeof value !== "string") return false;
    const v = value.trim().toLowerCase();
    if (!v) return false;
    if (v.startsWith("#") || v.startsWith("rgb(") || v.startsWith("rgba(") || v.startsWith("hsl(") || v.startsWith("hsla(")) {
      return true;
    }

    const commonNamedColors = {
      black: true,
      white: true,
      red: true,
      green: true,
      blue: true,
      yellow: true,
      orange: true,
      purple: true,
      pink: true,
      gray: true,
      grey: true,
      brown: true,
      cyan: true,
      magenta: true
    };
    return !!commonNamedColors[v];
  }

  function isColorVariableName(name) {
    if (typeof name !== "string") return false;
    return /color|colour|stroke|fill|tint|hue|bg|background/i.test(name);
  }

  function guify(varName, guiType, params, options) {
    const opts = options || {};
    const parentId = opts.parentId || "active-gui-area";

    let previousValue = readSketchVariable(varName);
    if (registry[varName]) {
      previousValue = readControlValue(registry[varName].control);
      registry[varName].container.remove();
      delete registry[varName];
    }

    const container = createDiv();
    container.parent(parentId);
    container.addClass("gui-row");

    const label = createSpan(varName);
    label.addClass("gui-label");
    label.parent(container);

    const control = createControl(guiType, params || []);
    control.parent(container);

    const valDisplay = createSpan(readControlValue(control));
    valDisplay.addClass("gui-val-text");
    valDisplay.parent(container);

    control.input(function () {
      const nextValue = readControlValue(control);
      writeSketchVariable(varName, nextValue);
      valDisplay.html(nextValue);
      if (typeof global.redraw === "function") {
        global.redraw();
      }
    });

    registry[varName] = { control: control, container: container };

    if (typeof previousValue !== "undefined") {
      writeControlValue(control, previousValue);
      writeSketchVariable(varName, previousValue);
      valDisplay.html(readControlValue(control));
    }

    return registry[varName];
  }

  function remove(varName, fallbackValue) {
    if (!registry[varName]) return;
    registry[varName].container.remove();
    delete registry[varName];
    if (typeof fallbackValue !== "undefined") {
      writeSketchVariable(varName, fallbackValue);
    }
  }

  function getValue(valueOrControl) {
    return readControlValue(valueOrControl);
  }

  function renderVariableList(parsedVariables, options) {
    const opts = options || {};
    const variableListId = opts.variableListId || "variable-list";
    const onSelectionChange = opts.onSelectionChange;
    const onConfigChange = opts.onConfigChange;
    const listDiv = global.document.getElementById(variableListId);
    if (!listDiv) return;

    listDiv.innerHTML = "";

    parsedVariables.forEach(function (varObj, index) {
      const itemDiv = global.document.createElement("div");
      itemDiv.className = "variable-item";
      itemDiv.innerHTML =
        '<div style="display: flex; align-items: center;">' +
        '<input type="checkbox" id="var-' + index + '" ' + (varObj.selected ? "checked" : "") + '>' +
        '<label for="var-' + index + '">' + varObj.name + "</label>" +
        "</div>" +
        '<span class="variable-meta">' +
        'Type: <span class="type-badge">' + varObj.type + "</span> | " +
        'Initial: <span>' + varObj.value + "</span>" +
        "</span>" +
        '<div class="variable-details">' +
        '<select id="guiType-' + index + '">' +
        '<option value="slider" ' + (varObj.guiType === "slider" ? "selected" : "") + ">slider</option>" +
        '<option value="color" ' + (varObj.guiType === "color" ? "selected" : "") + ">color</option>" +
        '<option value="checkbox" ' + (varObj.guiType === "checkbox" ? "selected" : "") + ">checkbox</option>" +
        "</select>" +
        '<input type="text" id="params-' + index + '" value="' + varObj.params + '">' +
        "</div>";
      listDiv.appendChild(itemDiv);

      global.document.getElementById("var-" + index).addEventListener("change", function (e) {
        parsedVariables[index].selected = e.target.checked;
        if (typeof onSelectionChange === "function") {
          onSelectionChange(parsedVariables[index], index);
        }
      });
      global.document.getElementById("guiType-" + index).addEventListener("change", function (e) {
        parsedVariables[index].guiType = e.target.value;
        if (typeof onConfigChange === "function") {
          onConfigChange(parsedVariables[index], index);
        }
      });
      global.document.getElementById("params-" + index).addEventListener("input", function (e) {
        parsedVariables[index].params = e.target.value;
        if (typeof onConfigChange === "function") {
          onConfigChange(parsedVariables[index], index);
        }
      });
    });
  }

  function applySelectedVariables(parsedVariables, options) {
    const opts = options || {};
    const parentId = opts.parentId || "active-gui-area";

    parsedVariables.forEach(function (varObj) {
      if (varObj.selected) {
        let paramsArray;
        try {
          paramsArray = eval("[" + varObj.params + "]");
          guify(varObj.name, varObj.guiType, paramsArray, { parentId: parentId });
        } catch (error) {
          global.console.error("Params error", error);
        }
      } else {
        remove(varObj.name, varObj.value);
      }
    });
  }

  function createVariablePanel(options) {
    injectStyles();

    const opts = options || {};
    const variableListId = opts.variableListId || "variable-list";
    const parentId = opts.parentId || "active-gui-area";
    const getCode = opts.getCode;
    const onAfterApply = opts.onAfterApply;
    const autoRefreshMs = typeof opts.autoRefreshMs === "number" ? opts.autoRefreshMs : 1200;

    if (typeof getCode !== "function") {
      throw new Error("createVariablePanel requires a getCode function");
    }

    const state = { parsedVariables: [] };
    let lastParsedCode = null;
    let refreshTimer = null;
    let lastParseErrorMessage = "";

    function applyVariable(varObj) {
      let paramsArray;
      try {
        paramsArray = eval("[" + varObj.params + "]");
        guify(varObj.name, varObj.guiType, paramsArray, { parentId: parentId });
      } catch (error) {
        global.console.error("Params error", error);
      }
    }

    async function parseAndRender(force) {
      const code = await getCode();
      lastParseErrorMessage = "";
      if (!force && code === lastParsedCode) {
        return state.parsedVariables;
      }

      const previousByName = Object.create(null);
      state.parsedVariables.forEach(function (entry) {
        previousByName[entry.name] = entry;
      });

      setupReactiveSketchGlobals(code || "");
      const nextParsed = parseVariableDefinitions(code || "");

      nextParsed.forEach(function (entry) {
        const previous = previousByName[entry.name];
        if (!previous) return;
        entry.selected = previous.selected;
        entry.guiType = previous.guiType;
        entry.params = previous.params;
      });

      state.parsedVariables = nextParsed;
      lastParsedCode = code;

      renderVariableList(state.parsedVariables, {
        variableListId: variableListId,
        onSelectionChange: function (varObj) {
          if (varObj.selected) {
            applyVariable(varObj);
          } else {
            remove(varObj.name, varObj.value);
          }
          if (typeof onAfterApply === "function") {
            onAfterApply(state.parsedVariables);
          }
        },
        onConfigChange: function (varObj) {
          if (varObj.selected) {
            applyVariable(varObj);
            if (typeof onAfterApply === "function") {
              onAfterApply(state.parsedVariables);
            }
          }
        }
      });

      applySelected();
      return state.parsedVariables;
    }

    function applySelected() {
      state.parsedVariables.forEach(function (varObj) {
        if (varObj.selected) {
          applyVariable(varObj);
        } else {
          remove(varObj.name, varObj.value);
        }
      });
      if (typeof onAfterApply === "function") {
        onAfterApply(state.parsedVariables);
      }
    }

    function startAutoRefresh() {
      if (autoRefreshMs <= 0) return;
      refreshTimer = global.setInterval(function () {
        parseAndRender(false).catch(function (error) {
          const message = error && error.message ? error.message : String(error);
          if (message !== lastParseErrorMessage) {
            lastParseErrorMessage = message;
            global.console.error("Guify parse failed", error);
          }
        });
      }, autoRefreshMs);
    }

    startAutoRefresh();

    return {
      parseAndRender: parseAndRender,
      applySelected: applySelected,
      getParsedVariables: function () {
        return state.parsedVariables;
      },
      dispose: function () {
        if (refreshTimer) {
          global.clearInterval(refreshTimer);
          refreshTimer = null;
        }
      }
    };
  }

  function createVariablePanelFromSketchFile(options) {
    const opts = options || {};

    function normalizePath(path) {
      if (!path || typeof path !== "string") return "";
      return path.trim();
    }

    function detectSketchScriptPath() {
      if (!global.document) return "";
      const scripts = Array.prototype.slice.call(global.document.querySelectorAll("script[src]"));
      const candidates = scripts
        .map(function (script) {
          const src = script.getAttribute("src") || "";
          return normalizePath(src);
        })
        .filter(function (src) {
          if (!src) return false;
          const lower = src.toLowerCase();
          if (lower.includes("p5.js") || lower.includes("p5.sound") || lower.includes("guify-core")) {
            return false;
          }
          return lower.endsWith(".js");
        });

      if (candidates.length === 0) return "";
      return candidates[candidates.length - 1];
    }

    const configuredPath = normalizePath(opts.sketchFilePath);
    const detectedPath = detectSketchScriptPath();
    const baseCandidates = [configuredPath, detectedPath, "sketch.js", "./sketch.js", "/sketch.js"];
    const sketchPathCandidates = baseCandidates.filter(function (path, index, arr) {
      return path && arr.indexOf(path) === index;
    });

    function withCacheBust(path) {
      const sep = path.indexOf("?") >= 0 ? "&" : "?";
      return path + sep + "guify_t=" + Date.now();
    }

    const nextOptions = Object.assign({}, opts, {
      getCode: async function () {
        for (let i = 0; i < sketchPathCandidates.length; i += 1) {
          const path = sketchPathCandidates[i];
          try {
            const response = await fetch(withCacheBust(path), { cache: "no-store" });
            if (!response.ok) continue;
            return response.text();
          } catch (error) {
          }
        }

        throw new Error("Failed to load sketch file. Tried: " + sketchPathCandidates.join(", "));
      }
    });
    return createVariablePanel(nextOptions);
  }

  function ensurePanelMarkup(options) {
    const opts = options || {};
    const variableListId = opts.variableListId || "variable-list";
    const parentId = opts.parentId || "active-gui-area";

    let root = global.document.getElementById("guify-panel-root");
    if (!root) {
      root = global.document.createElement("div");
      root.id = "guify-panel-root";
      global.document.body.appendChild(root);
    }

    let parent = global.document.getElementById(parentId);
    if (!parent) {
      parent = global.document.createElement("div");
      parent.id = parentId;
      root.appendChild(parent);
    }

    let title = global.document.getElementById("guify-title");
    if (!title) {
      title = global.document.createElement("h3");
      title.id = "guify-title";
      title.textContent = "Guify";
      root.insertBefore(title, root.firstChild);
    }

    let variableList = global.document.getElementById(variableListId);
    if (!variableList) {
      variableList = global.document.createElement("div");
      variableList.id = variableListId;
      root.appendChild(variableList);
    }

    if (parent.parentNode !== root) root.appendChild(parent);
    if (variableList.parentNode !== root) root.appendChild(variableList);

    if (title.parentNode !== root) root.insertBefore(title, root.firstChild);

    if (root.firstChild !== title) {
      root.insertBefore(title, root.firstChild);
    }

    if (title.nextSibling !== parent) {
      root.insertBefore(parent, title.nextSibling);
    }

    const parseButton = global.document.getElementById("parseBtn");
    if (parseButton) parseButton.remove();
    const applyButton = global.document.getElementById("guifyBtn");
    if (applyButton) applyButton.remove();

    return true;
  }

  function autoBootstrap(options) {
    const opts = options || {};
    if (!global.document) return null;
    injectStyles();
    if (!ensurePanelMarkup(opts)) return null;

    const panel = createVariablePanelFromSketchFile(opts);
    panel.parseAndRender().catch(function (error) {
      global.console.error("Guify parse failed", error);
    });
    return panel;
  }

  global.Guify = {
    extractDeclaredVariableNames: extractDeclaredVariableNames,
    parseVariableDefinitions: parseVariableDefinitions,
    renderVariableList: renderVariableList,
    applySelectedVariables: applySelectedVariables,
    createVariablePanel: createVariablePanel,
    createVariablePanelFromSketchFile: createVariablePanelFromSketchFile,
    autoBootstrap: autoBootstrap,
    injectStyles: injectStyles,
    readControlValue: readControlValue,
    writeControlValue: writeControlValue,
    setupReactiveSketchGlobals: setupReactiveSketchGlobals,
    guify: guify,
    remove: remove,
    getValue: getValue
  };

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", function () {
      autoBootstrap({ sketchFilePath: "sketch.js" });
    });
  } else if (global.document) {
    autoBootstrap({ sketchFilePath: "sketch.js" });
  }
})(window);
