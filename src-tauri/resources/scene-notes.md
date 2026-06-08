snippr scene format
===================

A scene is a JSON object applied onto a base image. Feed it to:

    snippr generate --input shot.png --scene scene.json --output out.png
    cat scene.json | snippr generate --input shot.png --scene - --output out.png

Run `snippr describe --json` for the full machine-readable JSON Schema.

Coordinate system
-----------------
- All coordinates are in BASE-IMAGE PIXELS (the input's native resolution).
- Origin (0,0) is the TOP-LEFT. +x right, +y down.
- Annotations may extend outside the image; the output auto-grows to wrap them
  (unless you set `cropRect`).
- Colors are CSS hex strings, e.g. "#ff3b30".

Top-level object
----------------
  annotations      array, painted back-to-front (required)
  backdrop         object | null   decorative padded backdrop (Beautify)
  cropRect         {x,y,width,height} | null   export crop
  boardBackground  string | null   whiteboard fill; null for screenshots

Annotation types (field `type`)  — every annotation needs a unique `id`
-----------------------------------------------------------------------
  rect       x,y(top-left) width height stroke strokeWidth
  shape      shape(triangle|diamond|star) x,y(top-left) width height stroke strokeWidth
  ellipse    x,y(CENTER) radiusX radiusY stroke strokeWidth
  arrow      points[x0,y0,x1,y1,...] stroke strokeWidth      (head at last point)
  line       points[...] stroke strokeWidth
  pen        points[...] stroke strokeWidth                  (freehand, smoothed)
  highlight  points[...] stroke strokeWidth                  (translucent marker)
  text       x,y(top-left) text fontSize fill
  badge      x,y(CENTER) number fill radius                  (numbered step dot)
  pixelate   x,y(top-left) width height pixelSize            (redact; screenshots only)
  loupe      srcX,srcY,size (source square) x,y(lens top-left) zoom shape
             borderColor borderWidth showSource connector    (magnifier; screenshots only)
  spotlight  x,y(top-left) width height shape(rect|ellipse) dim feather invert

`points` is a FLAT number array [x0,y0,x1,y1,...] (Konva convention), not {x,y} pairs.

Example
-------
{
  "annotations": [
    { "id": "a1", "type": "rect", "x": 40, "y": 60, "width": 220, "height": 90,
      "stroke": "#ff3b30", "strokeWidth": 4 },
    { "id": "a2", "type": "arrow", "points": [300, 200, 150, 120],
      "stroke": "#ff3b30", "strokeWidth": 4 },
    { "id": "a3", "type": "text", "x": 40, "y": 160, "text": "Look here",
      "fontSize": 28, "fill": "#ffffff" },
    { "id": "a4", "type": "badge", "x": 150, "y": 105, "number": 1,
      "fill": "#ff3b30", "radius": 18 }
  ],
  "backdrop": null,
  "cropRect": null,
  "boardBackground": null
}
