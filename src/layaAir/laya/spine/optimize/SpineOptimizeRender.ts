import { stage } from "../../../Laya";
import { BaseRender2DType, BaseRenderNode2D } from "../../NodeRender2D/BaseRenderNode2D";
import { IIndexBuffer } from "../../RenderDriver/DriverDesign/RenderDevice/IIndexBuffer";
import { IRenderGeometryElement } from "../../RenderDriver/DriverDesign/RenderDevice/IRenderGeometryElement";
import { IVertexBuffer } from "../../RenderDriver/DriverDesign/RenderDevice/IVertexBuffer";
import { BufferUsage } from "../../RenderEngine/RenderEnum/BufferTargetType";
import { DrawType } from "../../RenderEngine/RenderEnum/DrawType";
import { IndexFormat } from "../../RenderEngine/RenderEnum/IndexFormat";
import { MeshTopology } from "../../RenderEngine/RenderEnum/RenderPologyMode";
import { Scene } from "../../display/Scene";
import { Sprite } from "../../display/Sprite";
import { ColorFilter } from "../../filters/ColorFilter";
import { LayaGL } from "../../layagl/LayaGL";
import { Color } from "../../maths/Color";
import { Matrix4x4 } from "../../maths/Matrix4x4";
import { Point } from "../../maths/Point";
import { Vector2 } from "../../maths/Vector2";
import { Vector4 } from "../../maths/Vector4";
import { Material } from "../../resource/Material";
import { Texture } from "../../resource/Texture";
import { Texture2D } from "../../resource/Texture2D";
import { Spine2DRenderNode } from "../Spine2DRenderNode";
import { SpineAdapter } from "../SpineAdapter";
import { ESpineRenderType } from "../SpineSkeleton";
import { SpineTemplet } from "../SpineTemplet";
import { ISpineRender } from "../interface/ISpineRender";

import { SpineShaderInit } from "../material/SpineShaderInit";
import { AnimationRenderProxy } from "./AnimationRenderProxy";
import { MultiRenderData } from "./MultiRenderData";
import { SketonOptimise, SkinAttach, TSpineBakeData } from "./SketonOptimise";
import { ISpineOptimizeRender } from "./interface/ISpineOptimizeRender";
import { IVBIBUpdate } from "./interface/IVBIBUpdate";

export class SpineOptimizeRender implements ISpineOptimizeRender {
    animatorMap: Map<string, AnimationRenderProxy>;
    currentAnimation: AnimationRenderProxy;
    bones: spine.Bone[];
    slots: spine.Slot[];



    skinRenderArray: SkinRender[];

    currentRender: SkinRender;

    _skinIndex: number = 0;

    _curAnimationName: string;

    // /**
    //  * Material
    //  */
    // material: IOptimizeMaterial;

    geoMap: Map<ESpineRenderType, TGeo>;

    private _isRender: boolean;

    spineColor: Color;

    _skeleton: spine.Skeleton;

    _state: spine.AnimationState;

    renderProxy: IRender;
    renderProxyMap: Map<ERenderProxyType, IRender>;

    _nodeOwner: Spine2DRenderNode;

    boneMat: Float32Array;

    isBake: boolean;

    bakeData: TSpineBakeData;

    private _renderProxytype: ERenderProxyType;

    colorFilter: ColorFilter = null;

    constructor(spineOptimize: SketonOptimise) {
        this.renderProxyMap = new Map();
        this.geoMap = new Map();
        this.animatorMap = new Map();
        this.skinRenderArray = [];
        this.boneMat = new Float32Array(spineOptimize.maxBoneNumber * 8);

        spineOptimize.skinAttachArray.forEach((value) => {
            this.skinRenderArray.push(new SkinRender(this, value));
        })

        let animators = spineOptimize.animators;
        for (let i = 0, n = animators.length; i < n; i++) {
            let animator = animators[i];
            this.animatorMap.set(animator.name, new AnimationRenderProxy(animator));
        }
        this.currentRender = this.skinRenderArray[this._skinIndex];//default
    }

    destroy(): void {
        //throw new Error("Method not implemented.");
    }

    initBake(obj: TSpineBakeData): void {
        this.bakeData = obj;
        if (obj) {
            let render = this.renderProxyMap.get(ERenderProxyType.RenderBake) as RenderBake || new RenderBake(this.bones, this.slots, this._nodeOwner);
            render.simpleAnimatorTexture = obj.texture2d;
            render._bonesNums = obj.bonesNums;
            render.aniOffsetMap = obj.aniOffsetMap;
            this.renderProxyMap.set(ERenderProxyType.RenderBake, render);
        }
        this.isBake = !!obj;
        if (this._curAnimationName) {
            this._clear();
            this.play(this._curAnimationName);
        }
        //throw new Error("Method not implemented.");
    }

    initRender(type: ESpineRenderType) {
        //buffers .pos .uv .color vbs ib

        let geoResult = this.geoMap.get(type);
        if (!geoResult) {
            let geo = LayaGL.renderDeviceFactory.createRenderGeometryElement(MeshTopology.Triangles, DrawType.DrawElement);
            let mesh = LayaGL.renderDeviceFactory.createBufferState();
            geo.bufferState = mesh;
            let vb = LayaGL.renderDeviceFactory.createVertexBuffer(BufferUsage.Dynamic);
            vb.vertexDeclaration = type == ESpineRenderType.rigidBody ? SpineShaderInit.SpineRBVertexDeclaration : SpineShaderInit.SpineFastVertexDeclaration;
            let ib = LayaGL.renderDeviceFactory.createIndexBuffer(BufferUsage.Dynamic);

            mesh.applyState([vb], ib);
            geo.indexFormat = IndexFormat.UInt16;
            // geo.instanceCount = 
            geoResult = { geo, vb, ib };
            this.geoMap.set(type, geoResult);
        }
        return geoResult;
    }

    changeSkeleton(skeleton: spine.Skeleton) {
        this._skeleton = skeleton;
        this.bones = skeleton.bones;
        this.slots = skeleton.slots;
        (this.renderProxyMap.get(ERenderProxyType.RenderNormal) as RenderNormal)._skeleton = skeleton;
    }

    init(skeleton: spine.Skeleton, templet: SpineTemplet, renderNode: Spine2DRenderNode, state: spine.AnimationState): void {
        this._skeleton = skeleton;
        this.bones = skeleton.bones;
        this.slots = skeleton.slots;
        this._nodeOwner = renderNode;
        let scolor = skeleton.color;
        this.spineColor = new Color(scolor.r * scolor.a, scolor.g * scolor.a, scolor.b * scolor.a, scolor.a);
        renderNode._spriteShaderData.setColor(SpineShaderInit.Color, this.spineColor);
        this.skinRenderArray.forEach((value) => {
            value.init(skeleton, templet, renderNode);
        });
        this._state = state;

        this.animatorMap.forEach((value, key) => {
            value.state = state;
        });
        let renderOptimize = new RenderOptimize(this.bones, this.slots, this._nodeOwner);
        let renderNormal = new RenderNormal(skeleton, this._nodeOwner);
        this.renderProxyMap.set(ERenderProxyType.RenderNormal, renderNormal);
        this.renderProxyMap.set(ERenderProxyType.RenderOptimize, renderOptimize);
    }

    get renderProxytype(): ERenderProxyType {
        return this._renderProxytype;
    }

    set renderProxytype(value: ERenderProxyType) {
        if (this.isBake && value == ERenderProxyType.RenderOptimize) {
            if (this.bakeData.aniOffsetMap[this._curAnimationName] != undefined) {
                value = ERenderProxyType.RenderBake;
            }
        }
        this.renderProxy = this.renderProxyMap.get(value);
        if (value == ERenderProxyType.RenderNormal) {
            this._nodeOwner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_FAST);
            this._nodeOwner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_RB);
        }
        this._renderProxytype = value;
    }

    beginCache() {
        //@ts-ignore
        this._state.apply = this._state.applyCache;
        //@ts-ignore
        this._state.getCurrentPlayTime = this._state.getCurrentPlayTimeByCache;
        //@ts-ignore
        this._skeleton.updateWorldTransform = this._skeleton.updateWorldTransformCache;
    }

    endCache() {
        //@ts-ignore
        this._state.apply = this._state.oldApply;
        //@ts-ignore
        this._state.getCurrentPlayTime = this._state.getCurrentPlayTimeOld;
        //@ts-ignore
        this._skeleton.updateWorldTransform = this._skeleton.oldUpdateWorldTransform;
    }

    setSkinIndex(index: number) {
        this._skinIndex = index;
        this.currentRender = this.skinRenderArray[index];
        switch (this.currentRender.skinAttachType) {
            case ESpineRenderType.boneGPU:
                this._nodeOwner._spriteShaderData.addDefine(SpineShaderInit.SPINE_FAST);
                this._nodeOwner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_RB);
                break;
            case ESpineRenderType.rigidBody:
                this._nodeOwner._spriteShaderData.addDefine(SpineShaderInit.SPINE_RB);
                this._nodeOwner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_FAST);
                break;
            case ESpineRenderType.normal:
                this._nodeOwner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_FAST);
                this._nodeOwner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_RB);
                break;
        }
        if (this.currentAnimation) {
            this._clear();
            this.play(this._curAnimationName);
        }
    }

    private _clear() {
        this._nodeOwner.clear();
        this._isRender = false;
    }

    play(animationName: string) {
        this._curAnimationName = animationName;
        let currentRender = this.currentRender;
        let oldRenderProxy = this.renderProxy;

        let old = this.currentAnimation;
        let oldSkinData = old ? old.currentSKin : null;
        let currentAnimation = this.currentAnimation = this.animatorMap.get(animationName);
        currentAnimation.skinIndex = this._skinIndex;
        let currentSKin = currentAnimation.currentSKin;
        if (old) {
            old.reset();
        }

        if (currentSKin.isNormalRender) {

            this.renderProxytype = ERenderProxyType.RenderNormal;
        }
        else {
            switch (this.currentRender.skinAttachType) {
                case ESpineRenderType.boneGPU:
                    this._nodeOwner._spriteShaderData.addDefine(SpineShaderInit.SPINE_FAST);
                    this._nodeOwner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_RB);
                    break;
                case ESpineRenderType.rigidBody:
                    this._nodeOwner._spriteShaderData.addDefine(SpineShaderInit.SPINE_RB);
                    this._nodeOwner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_FAST);
                    break;
                case ESpineRenderType.normal:
                    this._nodeOwner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_FAST);
                    this._nodeOwner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_RB);
                    break;
            }
            if (old && oldSkinData.isNormalRender) {
                this._clear();
            }
            if (oldSkinData != currentSKin) {
                currentRender.updateVB(currentSKin.vb.vb, currentSKin.vb.vbLength);
            }
            //currentAnimation.
            // old.animator.mutiRenderAble
            let mutiRenderAble = currentSKin.mutiRenderAble;
            if (this._isRender) {
                if (mutiRenderAble != oldSkinData.mutiRenderAble) {
                    this._clear();
                }
            }
            if (!this._isRender) {
                if (mutiRenderAble) {
                    //this._nodeOwner.drawGeos(currentRender.geo, currentRender.elements);
                    this.renderProxytype = ERenderProxyType.RenderOptimize;
                }
                else {
                    currentRender.material && this._nodeOwner.drawGeo(currentRender.geo, currentRender.material);
                    this.renderProxytype = ERenderProxyType.RenderOptimize;
                }
                this._isRender = true;
            }
        }
        if (oldRenderProxy) {
            oldRenderProxy.leave();
        }
        this.renderProxy.change(currentRender, currentAnimation);
        if ((currentAnimation.animator.isCache || this.renderProxytype == ERenderProxyType.RenderBake) && !currentSKin.isNormalRender) {
            this.beginCache();
        }
        else {
            this.endCache();
        }
    }

    render(time: number): void {
        this.renderProxy.colorFilter = this.colorFilter;
        this.renderProxy.render(time, this.boneMat);
    }
}
enum ERenderProxyType {
    RenderNormal,
    RenderOptimize,
    RenderBake
}
interface IRender {
    colorFilter: ColorFilter;
    change(skinRender: SkinRender, currentAnimation: AnimationRenderProxy): void;
    leave(): void;
    render(curTime: number, boneMat: Float32Array): void;
}
class RenderOptimize implements IRender {
    bones: spine.Bone[];
    slots: spine.Slot[];
    colorFilter: ColorFilter = null;

    _renderNode: Spine2DRenderNode;
    skinRender: SkinRender;
    currentAnimation: AnimationRenderProxy;

    constructor(bones: spine.Bone[], slots: spine.Slot[], renderNode: Spine2DRenderNode) {
        this.bones = bones;
        this.slots = slots;
        this._renderNode = renderNode;
    }
    change(currentRender: SkinRender, currentAnimation: AnimationRenderProxy) {
        this.skinRender = currentRender;
        this.currentAnimation = currentAnimation;
    }
    leave(): void {

    }

    render(curTime: number, boneMat: Float32Array) {
        this.currentAnimation.render(this.bones, this.slots, this.skinRender, curTime, boneMat);//TODO bone
        // this.material.boneMat = boneMat;
        this._renderNode._spriteShaderData.setBuffer(SpineShaderInit.BONEMAT, boneMat);
        if (this.colorFilter) {
            let ft = this.colorFilter;
            this._renderNode._spriteShaderData.addDefine(SpineShaderInit.SPINE_COLOR_FILTER);
            Matrix4x4.TEMPMatrix0.cloneByArray(ft._mat);
            this._renderNode._spriteShaderData.setMatrix4x4(SpineShaderInit.SPINE_COLOR_MAT, Matrix4x4.TEMPMatrix0);
            Vector4.tempVec4.setValue(ft._alpha[0], ft._alpha[1], ft._alpha[2], ft._alpha[3]);
            this._renderNode._spriteShaderData.setVector(SpineShaderInit.SPINE_COLOR_ALPHA, Vector4.tempVec4);
        } else {
            this._renderNode._spriteShaderData.removeDefine(SpineShaderInit.SPINE_COLOR_FILTER);
        }

        this.checkCulling();
    }

    checkCulling() {
        if (!SpineShaderInit.SPINE_CULLING_STATUS) {
            this._renderNode._spriteShaderData.removeDefine(SpineShaderInit.SPINE_CULLING_CONTROL);
            return;
        }
        let sp = this._renderNode.owner.parent as Sprite;
        while (
            sp.parent
            && !(sp instanceof Scene)
            && (!sp.width || !sp.height)
        ) {
            sp = sp.parent as Sprite;
        }
        if (sp && (sp instanceof Sprite) && sp.width > 0 && sp.height > 0) {
            this._renderNode._spriteShaderData.addDefine(SpineShaderInit.SPINE_CULLING_CONTROL);
            Point.TEMP.setTo(0, 0);
            sp.localToGlobal(Point.TEMP);
            Vector4.tempVec4.x = Point.TEMP.x;
            Vector4.tempVec4.y = stage.height - Point.TEMP.y;
            Point.TEMP.setTo(sp.width, sp.height);
            sp.localToGlobal(Point.TEMP);
            Vector4.tempVec4.z = Point.TEMP.x;
            Vector4.tempVec4.w = stage.height - Point.TEMP.y;
            this._renderNode._spriteShaderData.setVector(SpineShaderInit.SPINE_CULLING, Vector4.tempVec4);
        } else {
            this._renderNode._spriteShaderData.removeDefine(SpineShaderInit.SPINE_CULLING_CONTROL);
            // Vector4.tempVec4.setValue(0, 0, 0, 0);
            // this._renderNode._spriteShaderData.setVector(SpineShaderInit.SPINE_CULLING, Vector4.tempVec4);
        }
    }
}

class RenderNormal implements IRender {
    _renderNode: Spine2DRenderNode;
    _renerer: ISpineRender;
    _skeleton: spine.Skeleton;
    colorFilter: ColorFilter;

    constructor(skeleton: spine.Skeleton, renderNode: Spine2DRenderNode) {
        this._renderNode = renderNode;
        this._skeleton = skeleton;
    }

    leave(): void {

    }

    change(currentRender: SkinRender, currentAnimation: AnimationRenderProxy) {
        this._renerer = currentRender._renerer;
    }

    render(curTime: number, boneMat: Float32Array) {
        this._renderNode.clear();
        this._renerer.draw(this._skeleton, this._renderNode, -1, -1);
    }

}

class RenderBake implements IRender {
    bones: spine.Bone[];
    slots: spine.Slot[];
    colorFilter: ColorFilter;
    /** @internal */
    _simpleAnimatorParams: Vector4;
    /** @internal */
    private _simpleAnimatorTextureSize: number;
    /** @internal */
    private _simpleAnimatorTexture: Texture2D;
    /** @internal  x simpleAnimation offset,y simpleFrameOffset*/
    private _simpleAnimatorOffset: Vector2;
    /** @internal */
    _bonesNums: number;
    aniOffsetMap: Record<string, number>;
    /**
     * 设置动画帧贴图
     */
    get simpleAnimatorTexture(): Texture2D {
        return this._simpleAnimatorTexture;
    }

    /**
     * @internal
     */
    set simpleAnimatorTexture(value: Texture2D) {
        if (this._simpleAnimatorTexture) {
            this._simpleAnimatorTexture._removeReference();
        }
        this._simpleAnimatorTexture = value;
        this._simpleAnimatorTextureSize = value.width;
        this._renderNode._spriteShaderData.setTexture(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURE, value);
        value._addReference();
        this._renderNode._spriteShaderData.setNumber(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURESIZE, this._simpleAnimatorTextureSize);
    }

    /**
     * @internal
     * 设置动画帧数参数
     */
    get simpleAnimatorOffset(): Vector2 {
        return this._simpleAnimatorOffset;
    }

    /**
     * @internal
     */
    set simpleAnimatorOffset(value: Vector2) {
        value.cloneTo(this._simpleAnimatorOffset);
    }


    _renderNode: Spine2DRenderNode;
    skinRender: SkinRender;
    currentAnimation: AnimationRenderProxy;
    step = 1 / 60;
    constructor(bones: spine.Bone[], slots: spine.Slot[], renderNode: Spine2DRenderNode) {
        this._simpleAnimatorParams = new Vector4();
        this.bones = bones;
        this.slots = slots;
        this._renderNode = renderNode;
        this._simpleAnimatorOffset = new Vector2();

    }

    leave() {
        this._renderNode._spriteShaderData.removeDefine(SpineShaderInit.SPINE_SIMPLE);
        //this._renderNode._spriteShaderData.removeDefine(SpineShaderInit.SPINE_GPU_INSTANCE);
        this._renderNode._renderType = BaseRender2DType.spine;
    }

    change(currentRender: SkinRender, currentAnimation: AnimationRenderProxy) {
        this.skinRender = currentRender;
        this.currentAnimation = currentAnimation;
        this._renderNode._spriteShaderData.addDefine(SpineShaderInit.SPINE_SIMPLE);
        this._simpleAnimatorOffset.x = this.aniOffsetMap[currentAnimation.name];
        if (currentAnimation.currentSKin.canInstance) {
            this._renderNode._renderType = BaseRender2DType.spineSimple;
            // this._renderNode._spriteShaderData.addDefine(SpineShaderInit.SPINE_GPU_INSTANCE);
        }
    }

    /**
     * @internal
     */
    _computeAnimatorParamsData() {
        this._simpleAnimatorParams.x = this._simpleAnimatorOffset.x;
        this._simpleAnimatorParams.y = Math.round(this._simpleAnimatorOffset.y) * this._bonesNums * 2;
    }

    /**
     * 自定义数据
     * @param value1 自定义数据1
     * @param value2 自定义数据1
     */
    setCustomData(value1: number, value2: number = 0) {
        this._simpleAnimatorParams.z = value1;
        this._simpleAnimatorParams.w = value2;
    }

    render(curTime: number, boneMat: Float32Array) {
        this.currentAnimation.renderWithOutMat(this.slots, this.skinRender, curTime);
        this._simpleAnimatorOffset.y = curTime / this.step;
        this._computeAnimatorParamsData();
        // let boneMat = this.currentAnimation.render(this.bones, this.slots, this.skinRender, curTime);//TODO bone
        // this.material.boneMat = boneMat;
        this._renderNode._spriteShaderData.setVector(SpineShaderInit.SIMPLE_SIMPLEANIMATORPARAMS, this._simpleAnimatorParams);
    }
}


class SkinRender implements IVBIBUpdate {

    owner: SpineOptimizeRender;
    name: string;
    /**
   * Geometry
   */
    geo: IRenderGeometryElement;

    protected vb: IVertexBuffer;
    protected ib: IIndexBuffer;
    elements: [Material, number, number][];
    private hasNormalRender: boolean;
    _renerer: ISpineRender;

    elementsMap: Map<number, ElementCreator>;

    templet: SpineTemplet;

    skinAttachType: ESpineRenderType;
    material: Material;
    currentMaterials: Material[] = [];
    constructor(owner: SpineOptimizeRender, skinAttach: SkinAttach) {
        this.owner = owner;
        this.name = skinAttach.name;
        this.elements = [];
        this.hasNormalRender = skinAttach.hasNormalRender;
        this.elementsMap = new Map();
        this.skinAttachType = skinAttach.type;
        // if (skinAttach.type == ERenderType.boneGPU) {
        //     this.materialConstructor = SpineFastMaterial;
        // }
        // else if (skinAttach.type == ERenderType.rigidBody) {
        //     this.materialConstructor = SpineRBMaterial;
        // }
        // else {
        //     this.materialConstructor = SpineFastMaterial;
        // }
        let geoResult = owner.initRender(skinAttach.type);
        this.geo = geoResult.geo;
        this.vb = geoResult.vb;
        this.ib = geoResult.ib;
    }

    getMaterialByName(name: string, blendMode: number): Material {
        return this.templet.getMaterial(this.templet.getTexture(name), blendMode);
    }



    updateVB(vertexArray: Float32Array, vbLength: number) {
        let vb = this.vb;
        let vblen = vbLength * 4;
        vb.setDataLength(vblen);
        vb.setData(vertexArray.buffer, 0, 0, vblen);
    }

    updateIB(indexArray: Uint16Array, ibLength: number, mutiRenderData: MultiRenderData, isMuti: boolean) {
        let ib = this.ib;
        let iblen = ibLength * 2;
        ib._setIndexDataLength(iblen)
        ib._setIndexData(new Uint16Array(indexArray.buffer, 0, iblen / 2), 0);
        this.geo.clearRenderParams();
        this.geo.setDrawElemenParams(iblen / 2, 0);
        this.ib.indexCount = iblen / 2;
        if (isMuti) {
            let elementsCreator = this.elementsMap.get(mutiRenderData.id);
            if (!elementsCreator) {
                elementsCreator = new ElementCreator(mutiRenderData, this);
                this.elementsMap.set(mutiRenderData.id, elementsCreator);
            }
            elementsCreator.cloneTo(this.elements);
            this.currentMaterials = elementsCreator.currentMaterials;
            this.owner._nodeOwner.updateElements(this.geo, this.elements);
        }
        else {
            let currentData = mutiRenderData.currentData;
            if (!currentData) return;
            let material = currentData.material;
            if (!material) {
                material = currentData.material = this.getMaterialByName(currentData.textureName, currentData.blendMode);
            }
            if (material != this.material) {
                this.owner._nodeOwner.clear();
                this.owner._nodeOwner.drawGeo(this.geo, material);
            }
        }
    }
    init(skeleton: spine.Skeleton, templet: SpineTemplet, renderNode: Spine2DRenderNode) {
        this.templet = templet;
        if (this.hasNormalRender) {
            this._renerer = SpineAdapter.createNormalRender(templet, false);
        }
        if (templet.mainTexture) {
            this.material = templet.getMaterial(templet.mainTexture, templet.mainBlendMode);
        }
    }

    render(time: number) {

    }
}

class ElementCreator {
    elements: [Material, number, number][];
    currentMaterials: Material[];

    constructor(mutiRenderData: MultiRenderData, skinData: SkinRender) {
        let elements: [Material, number, number][] = this.elements = [];
        let currentMaterials: Material[] = this.currentMaterials = [];
        let renderData = mutiRenderData.renderData;
        for (let i = 0, n = renderData.length; i < n; i++) {
            let data = renderData[i];
            let mat = skinData.getMaterialByName(data.textureName, data.blendMode);
            if (currentMaterials.indexOf(mat) == -1) {
                this.currentMaterials.push(mat);
            }
            elements[i] = [mat, data.length, data.offset * 2];
        }
    }

    cloneTo(source: [Material, number, number][]) {
        let target = this.elements;
        for (let i = 0, n = target.length; i < n; i++) {
            source[i] = target[i];
        }
        source.length = target.length;
    }
}

type TGeo = {
    geo: IRenderGeometryElement;
    vb: IVertexBuffer;
    ib: IIndexBuffer;
}