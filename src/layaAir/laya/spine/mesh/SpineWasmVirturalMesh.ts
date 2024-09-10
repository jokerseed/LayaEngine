
import { IRenderElement2D } from "../../RenderDriver/DriverDesign/2DRenderPass/IRenderElement2D";
import { type VertexDeclaration } from "../../RenderEngine/VertexDeclaration";
import { LayaGL } from "../../layagl/LayaGL";
import { type Material } from "../../resource/Material";
import { SpineShaderInit } from "../material/SpineShaderInit";
import { SpineMeshBase } from "./SpineMeshBase";

export class SpineWasmVirturalMesh extends SpineMeshBase {

    private _renderElement2D: IRenderElement2D;
    constructor(material: Material) {
        super(material);
        this._renderElement2D = LayaGL.render2DRenderPassFactory.createRenderElement2D();
        this._renderElement2D.geometry = this.geo;
    }

    get vertexDeclarition(): VertexDeclaration {
        return SpineShaderInit.SpineNormalVertexDeclaration;
    }
}
