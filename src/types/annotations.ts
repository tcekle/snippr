/** Polygon variants living under the shape-tool flyout (rect/ellipse have their own anno types). */
export type ShapeKind = 'triangle'|'diamond'|'star';
export type ToolType = 'select'|'rect'|'ellipse'|'arrow'|'line'|'pen'|'highlight'|'text'|'badge'|'pixelate'|'crop'|'backdrop'|ShapeKind;

type Base = { id: string; };
export type RectAnno      = Base & { type:'rect'; x:number; y:number; width:number; height:number; stroke:string; strokeWidth:number };
export type ShapeAnno     = Base & { type:'shape'; shape:ShapeKind; x:number; y:number; width:number; height:number; stroke:string; strokeWidth:number };
export type EllipseAnno   = Base & { type:'ellipse'; x:number; y:number; radiusX:number; radiusY:number; stroke:string; strokeWidth:number };
export type ArrowAnno     = Base & { type:'arrow'; points:number[]; stroke:string; strokeWidth:number };
export type LineAnno      = Base & { type:'line'; points:number[]; stroke:string; strokeWidth:number };
export type PenAnno       = Base & { type:'pen'; points:number[]; stroke:string; strokeWidth:number };
export type HighlightAnno = Base & { type:'highlight'; points:number[]; stroke:string; strokeWidth:number };
export type TextAnno      = Base & { type:'text'; x:number; y:number; text:string; fontSize:number; fill:string };
export type BadgeAnno     = Base & { type:'badge'; x:number; y:number; number:number; fill:string; radius:number };
export type PixelateAnno  = Base & { type:'pixelate'; x:number; y:number; width:number; height:number; pixelSize:number };
export type ImageAnno     = Base & { type:'image'; x:number; y:number; width:number; height:number; imageEl:HTMLImageElement; src:string };
export type Annotation = RectAnno|ShapeAnno|EllipseAnno|ArrowAnno|LineAnno|PenAnno|HighlightAnno|TextAnno|BadgeAnno|PixelateAnno|ImageAnno;
