/** Non-destructive crop frame, applied at export. `rotation` straightens by
 *  rotating the image (and its annotations) beneath an UPRIGHT crop frame,
 *  Lightroom-style; degrees, positive = clockwise. Omitted/0 = no rotation. */
export interface CropRect { x:number; y:number; width:number; height:number; rotation?:number }

/** Polygon variants living under the shape-tool flyout (rect/ellipse have their own anno types). */
export type ShapeKind = 'triangle'|'diamond'|'star';
export type ToolType = 'select'|'rect'|'ellipse'|'arrow'|'line'|'pen'|'highlight'|'text'|'badge'|'pixelate'|'crop'|'backdrop'|'loupe'|'spotlight'|ShapeKind;

type Base = { id: string; };

/** Hand-drawn rendering, opt-in per annotation. `seed` is stored rather than
 *  derived at render so the wobble is identical across reloads and in the
 *  exported PNG; omitted on documents saved before sketch existed, where the
 *  renderer falls back to hashing the id. */
export type Sketchable = { sketch?:boolean; seed?:number; roughness?:number };

/** Signed bow as a fraction of the chord, so the arc holds its proportion when
 *  the arrow is resized. 0 = straight. Independent of `sketch`. */
export type Bowable = { curve?:number };

export type RectAnno      = Base & Sketchable & { type:'rect'; x:number; y:number; width:number; height:number; stroke:string; strokeWidth:number };
export type ShapeAnno     = Base & Sketchable & { type:'shape'; shape:ShapeKind; x:number; y:number; width:number; height:number; stroke:string; strokeWidth:number };
export type EllipseAnno   = Base & Sketchable & { type:'ellipse'; x:number; y:number; radiusX:number; radiusY:number; stroke:string; strokeWidth:number };
/** Arrowhead size as a multiplier on the stroke-proportional default. 1 = the
 *  proportional size; raise it for a heavy head on a thin leader. */
export type ArrowAnno     = Base & Sketchable & Bowable & { type:'arrow'; points:number[]; stroke:string; strokeWidth:number; headScale?:number };
export type LineAnno      = Base & Sketchable & Bowable & { type:'line'; points:number[]; stroke:string; strokeWidth:number };
export type PenAnno       = Base & { type:'pen'; points:number[]; stroke:string; strokeWidth:number };
export type HighlightAnno = Base & { type:'highlight'; points:number[]; stroke:string; strokeWidth:number };
export type TextAnno      = Base & { type:'text'; x:number; y:number; text:string; fontSize:number; fill:string; fontFamily?:string };
export type BadgeAnno     = Base & Sketchable & { type:'badge'; x:number; y:number; number:number; fill:string; radius:number };
export type PixelateAnno  = Base & { type:'pixelate'; x:number; y:number; width:number; height:number; pixelSize:number };
export type ImageAnno     = Base & { type:'image'; x:number; y:number; width:number; height:number; imageEl:HTMLImageElement; src:string };
export type LoupeAnno     = Base & {
  type:'loupe';
  srcX:number; srcY:number; size:number;   // square source region (image space)
  x:number; y:number;                       // lens top-left (image space)
  zoom:number;                              // magnification factor
  shape:'circle'|'rect';
  borderColor:string; borderWidth:number;
  showSource:boolean;
  connector:boolean;
};
export type SpotlightAnno = Base & { type:'spotlight'; x:number; y:number; width:number; height:number; shape:'rect'|'ellipse'; dim:number; feather:number; invert:boolean };
export type Annotation = RectAnno|ShapeAnno|EllipseAnno|ArrowAnno|LineAnno|PenAnno|HighlightAnno|TextAnno|BadgeAnno|PixelateAnno|ImageAnno|LoupeAnno|SpotlightAnno;
