import { stage } from "../../../Laya";
import { Scene } from "../../display/Scene";
import { Sprite } from "../../display/Sprite";
import { ColorFilter } from "../../filters/ColorFilter";
import { Color } from "../../maths/Color";
import { Matrix4x4 } from "../../maths/Matrix4x4";
import { Point } from "../../maths/Point";
import { Vector4 } from "../../maths/Vector4";
import { Spine2DRenderNode } from "../Spine2DRenderNode";
import { SpineAdapter } from "../SpineAdapter";
import { SpineTemplet } from "../SpineTemplet";
import { ISpineRender } from "../interface/ISpineRender";
import { SpineShaderInit } from "../material/SpineShaderInit";
import { TSpineBakeData } from "./SketonOptimise";
import { ISpineOptimizeRender } from "./interface/ISpineOptimizeRender";

export class SpineNormalRender implements ISpineOptimizeRender {
    colorFilter: ColorFilter = null;
    alpha: number = null;

    destroy(): void {
        //throw new Error("Method not implemented.");
    }
    initBake(obj: TSpineBakeData): void {
        //throw new Error("Method not implemented.");
    }

    _owner: Spine2DRenderNode;
    _renerer: ISpineRender;
    _skeleton: spine.Skeleton;

    init(skeleton: spine.Skeleton, templet: SpineTemplet, renderNode: Spine2DRenderNode, state: spine.AnimationState): void {
        this._renerer = SpineAdapter.createNormalRender(templet, false);
        this._skeleton = skeleton;
        this._owner = renderNode;
        let scolor = skeleton.color;
        let color = new Color(scolor.r * scolor.a, scolor.g * scolor.a, scolor.b * scolor.a, scolor.a);
        renderNode._spriteShaderData.setColor(SpineShaderInit.Color, color);
        renderNode._spriteShaderData.removeDefine(SpineShaderInit.SPINE_FAST);
        renderNode._spriteShaderData.removeDefine(SpineShaderInit.SPINE_RB);
    }

    play(animationName: string): void {

    }
    setSkinIndex(index: number): void {
        //throw new Error("Method not implemented.");
    }


    changeSkeleton(skeleton: spine.Skeleton) {
        this._skeleton = skeleton;
    }

    render(time: number) {
        this._owner.clear();

        if (this.alpha != null) {
            this._owner._spriteShaderData.addDefine(SpineShaderInit.SPINE_ALPHA_CONTROL);
            this._owner._spriteShaderData.setNumber(SpineShaderInit.SPINE_ALPHA, this.alpha);
        } else {
            this._owner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_ALPHA_CONTROL);
        }
        if (this.colorFilter) {
            let ft = this.colorFilter;
            this._owner._spriteShaderData.addDefine(SpineShaderInit.SPINE_COLOR_FILTER);
            Matrix4x4.TEMPMatrix0.cloneByArray(ft._mat);
            this._owner._spriteShaderData.setMatrix4x4(SpineShaderInit.SPINE_COLOR_MAT, Matrix4x4.TEMPMatrix0);
            Vector4.tempVec4.setValue(ft._alpha[0], ft._alpha[1], ft._alpha[2], ft._alpha[3]);
            this._owner._spriteShaderData.setVector(SpineShaderInit.SPINE_COLOR_ALPHA, Vector4.tempVec4);
        } else {
            this._owner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_COLOR_FILTER);
        }
        this.checkCulling();

        this._renerer.draw(this._skeleton, this._owner, -1, -1);
    }

    checkCulling() {
        if (!SpineShaderInit.SPINE_CULLING_STATUS) {
            this._owner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_CULLING_CONTROL);
            return;
        }
        let sp = this._owner.owner.parent as Sprite;
        while (
            sp.parent
            && !(sp instanceof Scene)
            && (!sp.width || !sp.height)
        ) {
            sp = sp.parent as Sprite;
        }
        if (sp && (sp instanceof Sprite) && sp.width > 0 && sp.height > 0) {
            this._owner._spriteShaderData.addDefine(SpineShaderInit.SPINE_CULLING_CONTROL);
            Point.TEMP.setTo(0, 0);
            sp.localToGlobal(Point.TEMP);
            Vector4.tempVec4.x = Point.TEMP.x;
            Vector4.tempVec4.y = stage.height - Point.TEMP.y;
            Point.TEMP.setTo(sp.width, sp.height);
            sp.localToGlobal(Point.TEMP);
            Vector4.tempVec4.z = Point.TEMP.x;
            Vector4.tempVec4.w = stage.height - Point.TEMP.y;
            this._owner._spriteShaderData.setVector(SpineShaderInit.SPINE_CULLING, Vector4.tempVec4);
        } else {
            this._owner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_CULLING_CONTROL);
            // Vector4.tempVec4.setValue(0, 0, 0, 0);
            // this._owner._spriteShaderData.setVector(SpineShaderInit.SPINE_CULLING, Vector4.tempVec4);
        }
    }
}