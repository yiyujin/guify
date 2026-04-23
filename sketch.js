let vCircleSize = 10;
let vCircleColor = 'red';
let vCircleX = 200;
let vCircleY = 200;

function setup() {
  let canvas = createCanvas(400, 400);
  canvas.parent('canvas-container');
  
  // You can manually guify here, or use the Parse Variables button
  // guify("vCircleSize", "slider", [10, 400, 100, 10]);
  // guify("vCircleColor", "color", ["deeppink"]);
}

function guify(varName, guiType, params) {
  let control;
  switch (guiType.toLowerCase()) {
    case "slider":
      control = createSlider(...params);
      break;
    case "color":
    case "colorpicker":
      control = createColorPicker(...params);
      break;
    case "checkbox":
      control = createCheckbox(...params);
      break;
  }
  
  // Assign to window so we can access it globally
  window[varName] = control;
  
  // Create a container div for label + control
  let container = createDiv();
  container.parent('controls');
  container.style('margin-bottom', '10px');
  container.style('display', 'flex');
  container.style('align-items', 'center');
  container.style('gap', '10px');
  
  // Create and style the label
  let label = createSpan(varName);
  label.style('min-width', '120px');
  label.style('font-family', 'monospace');
  label.parent(container);
  
  // Add control to container
  control.parent(container);
  control.style('margin-bottom', '0'); // Remove individual margin
}

function draw() {
  background(200);
  
  // Access through window to get the guified version
  let circleSize = getValue(window.vCircleSize || vCircleSize);
  let circleColor = getValue(window.vCircleColor || vCircleColor);
  let circleX = getValue(window.vCircleX || vCircleX);
  let circleY = getValue(window.vCircleY || vCircleY);
  
  fill(circleColor);
  circle(circleX, circleY, circleSize);
}

function getValue(v) {
  return (v && typeof v.value === 'function') ? v.value() : v;
}