viewof drSelection = BrushableScatterPlot(dataToPlot, {
  color: colorBy,
  size: colorBy,
  interactive,
  colorOnHover: false,
  tooltip: [
    "title",
    "award",
    "score",
    "track",
    "firstSessionName",
    "authorNames",
    "abstract"
  ]
})

papersHighlighted = drSelection.brushed;

paperClicked = drSelection.clicked;

Array.from({ length: 100 }).map(() => ({
    x: Math.random(),
    y: Math.random()
  }))

BrushableScatterPlot(
  Array.from({ length: 100 }).map(() => ({
    x: Math.random(),
    y: Math.random(),
    type: ["a", "b", "c"][Math.floor(Math.random() * 3)]
  })),
  {
    shape: "type",
    shapeDomain: ["c", "b", "a"],
    size: 100,
    vegaSpecWrapper: (spec) => {
      const hello = vl
        .markText()
        .encode(
          vl.text().fieldN("text"),
          vl.x().fieldQ("x"),
          vl.y().fieldQ("y")
        )
        .data([{ text: "Hello", type: "text", x: 0, y: 0 }]);
      return vl.layer(spec, hello);
    }
  }
)

viewof maxPapers = Inputs.range([0, dataToPlot.length], {
  label: "Papers to show",
  step: 1,
  value: 20
})

selectedPapers = htl.html`   
  <h2>CHI 2024 artifacts selected</h2>
  ${
    paperClicked.length
      ? htl.html`<strong>Clicked:</strong>${paperClicked.map(renderItem)}`
      : ""
  }
  <div style="display: flex; flex-wrap: wrap; max-height: 600px; overflow: scroll">
    
      ${papersHighlighted
        .sort((a, b) => b.score - a.score)
        .slice(0, maxPapers)
        .map(renderItem)}
`

async function BrushableScatterPlot(dataToPlot, options) {
  options = {
    interactive: true,
    colorScheme: undefined, 
    colorSchemeNominal: "tableau20",
    colorSchemeQuantitative: "brownbluegreen",
    colorType: undefined, 
    x: "x",
    y: "y",
    color: null, // null for no color, you can also pass an attribute name
    size: null, // null for no size, you can also pass an attribute name
    shape: null, // null for no shape, you can also pass an attribute name
    id: null, // null will use the index, you can also pass an attribute name for id
    tooltip: undefined,
    colorDomain: null, // e.g. [-0.2, 7]
    title: `${dataToPlot.length} documents by similarity`,
    //adjusts size of graph based on the size of the screen
    width: Math.min(600, window.innerWidth - 20), 
    height: Math.min(600, window.innerHeight - 100),
    sizeRange: undefined, // e.g. [0, 100]
    vegaSpecWrapper: (d) => d, // Use it to enhance the vega spec, e.g. to add layers to it
    colorOnHover: true,
    shapeDomain: undefined,  // provide a custom array of values from the domain if you want
    ...options
  };

  if (!options.id) {
    if (dataToPlot?.length && "id" in dataToPlot[0]) {
      options.id = "id";
    } else {
      // If no id, use the index as id
      dataToPlot.map((d, i) => (d.id = i));
      options.id = "id";
    }
  }

  options.tooltip = options.tooltip || [
    options.id,
    options.x,
    options.y,
    options.color,
    options.size
  ];

  const vegaView = options.vegaSpecWrapper(getVegaView(dataToPlot, options));
  let brushed = dataToPlot;
  let clicked = [];
  //stores data for double click 
  let previousClickedIds = [];

  // *** Get Vega ***
  const vegaReactiveChart = await (options.interactive
    ? vegaSelected(vegaView.toSpec(), { renderer: "canvas" })
    : vegaView.render());

  const target = html`${vegaReactiveChart}`;

  
  function setValue(brushed, clicked) {
    target.value = { brushed, clicked };
     // No need to disptach the input event as the one from the inner widget will bubble out
     // target.dispatchEvent(new CustomEvent("input", { bubbles: true }));
  }
  // Added a single event listener to handle interactions, simplifying the logic by adding both drag and click handling here
  vegaReactiveChart.addEventListener("input", (evt) => {
    evt.stopPropagation();

    //Drag interaction: Filters the data points within the drag selection region
    if (vegaReactiveChart.value.drag) {
      brushed = vegaReactiveChart.value.drag
        ? dataToPlot.filter(
            (d) =>
              d.x >= vegaReactiveChart.value.drag.x[0] &&
              d.x <= vegaReactiveChart.value.drag.x[1] &&
              d.y >= vegaReactiveChart.value.drag.y[0] &&
              d.y <= vegaReactiveChart.value.drag.y[1]
          )
        : dataToPlot;
    }
    // Double-click interaction: Handles clicks on the chart to open a URL if the item was already clicked
    if (vegaReactiveChart.value.click) {
      const newlyClicked = dataToPlot.filter((d) =>
        vegaReactiveChart.value.click?.id.includes(d.id)
      );

      const newlyClickedIds = newlyClicked.map((d) => d.id);
      // Checks if the clicked item was already selected (double-click logic)
      const wasAlreadySelected = newlyClickedIds.some(id => previousClickedIds.includes(id));

      if (wasAlreadySelected) {
        const paper = dataToPlot.find((d) => d.id === newlyClickedIds[0]);
        // Opens the URL of the double-clicked item in a new tab or window
        if (paper?.url) window.open(paper.url, "_blank");
      }
      // Updates clicked and brushed states to reflect the new selection
      clicked = newlyClicked;
      previousClickedIds = newlyClickedIds;
      brushed = dataToPlot; // Clears brush on a click interaction
    }

    setValue(brushed, clicked);
  });

  setValue(brushed, clicked);
  return target;
}

function getVegaView(dataToPlot, options) {
  let {
    interactive,
    colorScheme,
    color,
    shape,
    x,
    y,
    size,
    id,
    tooltip,
    colorDomain,
    title,
    shapeDomain
  } = options;

  let colorField = vl.color();

  if (dataToPlot.length && isNaN(dataToPlot[0][color])) {
    options.colorType = options.colorType || "nominal";
  } else {
    options.colorType = options.colorType || "quantitative";
  }

  colorScheme =
    colorScheme ||
    (options.colorType === "quantitative"
      ? options.colorSchemeQuantitative
      : options.colorSchemeNominal);

  colorField = colorField
    .field(color)
    .type(options.colorType)
    .scale({ scheme: colorScheme });

  let chart = vl
    .markPoint({ opacity: 0.6, filled: true, size: 100 }) // Changed size to a default value of 100 for all points
    .encode(vl.x().fieldQ(x).axis(null), vl.y().fieldQ(y).axis(null))
    .width(options.width)
    .height(options.height)
    .data(dataToPlot);

  if (color) chart = chart.encode(colorField);

  if (size) {
    if (typeof size === "number") {
      chart = chart.encode(vl.size().value(size));
    } else {
      chart = chart.encode(
        vl.size().fieldQ(size).scale({ range: options.sizeRange }),
        vl.order().fieldQ(size)
      );
    }
  }

  if (shape) {
    let shapeEncoding = vl.shape().fieldN(shape);
    if (shapeDomain) {
      shapeEncoding = shapeEncoding.scale({ domain: shapeDomain });
    }
    chart = chart.encode(shapeEncoding);
  }

  const events = "mouseover,pointerover,touchmove,touchend,click"; // Added touch events to improve mobile interactions

  if (interactive) {
    // console.log("vega interactive!", interactive);
    const hover = vl
      .selectSingle("hover")
      .nearest(true)
      .on(events)
      .clear("none")
      .init({ x: [], y: [] });
    //added functionality on mobile devices enabling dragging interactions using mouse or touch events
    const drag = vl
      // Creates an interval selection named "drag" to allow users to interact with the chart by defining a rectangular selection
      .selectInterval("drag")
      // Configures the drag behavior to work with both mouse and mobile devices.
      // Listens for drag initiation via mousedown or touchstart, 
      // drag movement via mousemove or touchmove, 
      // and drag completion via mouseup or touchend events.
      .on("[mousedown, window:mouseup] > window:mousemove!, [touchstart, window:touchend] > window:touchmove!")
      .translate("[mousedown, window:mouseup] > window:mousemove!, [touchstart, window:touchend] > window:touchmove!");

    const click = vl
      .selectPoint("click")
      .fields([id])
      //.nearest(true)
      .on("click, touchend")
      .init({ id: [] });

    chart = chart.params(click, hover, drag).encode(
      vl
        .stroke()
        .condition({ param: "click", value: "black", empty: false })
        // .condition({param: "hover", value: "grey", empty: false})
        .value(null),
      // vl.size().if(vl.or(hover, drag), vl.value(80)).value(50),

      vl.tooltip(tooltip)
    );

    if (color) {
      const colorCondition = options.colorOnHover ? vl.or(hover, drag) : drag;
      chart = chart.encode(
        vl.color().if(colorCondition, colorField).value("grey")
      );
    }
  }
  // console.log("chart", chart.toObject());
  return chart.title(title).width(options.width).height(options.height);
}

function renderItem(p) {
  return htl.html`
      <div style="width: 150px; flex: 1; padding-right: 10px; padding-bottom: 15px">
        <strong><a href=${p.url}>${p.title}</a></strong>  
        <div>Similarity score: ${(p.score * 100).toFixed(2)}% ${
    p.awards ? p.awards : ""
  }</div>
        <div style="font-style: italic; max-height: 4em; overflow: auto;">${p.authorsExpanded
          .map((a) => `${a.firstName} ${a.lastName}`)
          .join(", ")}</div>
        <div>${p.track} - ${p.firstSessionName}</div> 
        <div style="margin-top: 0.5em; max-height: 70px; overflow: auto">${
          p.abstract
        }</div>
      </div>
`;
}

dataToPlot = FileAttachment("dataToPlot.json").json()

import {vegaSelected} from "@john-guerra/vega-selected"

import {vl} from "@vega/vega-lite-api-v5"
