import { AnimationRender, SkinAniRenderData } from "./AnimationRender";
import { IVBIBUpdate } from "./interface/IVBIBUpdate";

export class AnimationRenderProxy {
    state: spine.AnimationState;
    currentTime: number;
    currentFrameIndex: number;
    animator: AnimationRender;
    //vb: VBCreator;
    currentSKin: SkinAniRenderData;

    constructor(animator: AnimationRender) {
        this.animator = animator;
        // this.vb = animator.vb;
        this.reset();
    }
    set skinIndex(value: number) {
        this.currentSKin = this.animator.skinDataArray[value];
    }

    get name() {
        return this.animator.name;
    }

    reset() {
        this.currentTime = -1;
        this.currentFrameIndex = -2;
    }
    renderWithOutMat(slots: spine.Slot[], updator: IVBIBUpdate, curTime: number) {
        let beforeFrame = this.currentFrameIndex;
        let nowFrame = this.animator.getFrameIndex(curTime, beforeFrame);
        let currentSKin = this.currentSKin;
        let vb = currentSKin.vb;
        if (currentSKin.checkVBChange(slots)) {
            updator.updateVB(vb.vb, vb.vbLength);
        }
        if (nowFrame != beforeFrame) {
            //TODO
            let ib = currentSKin.getIB(nowFrame);
            updator.updateIB(ib.realIb, ib.realIb.length, ib.outRenderData, currentSKin.mutiRenderAble);
            this.currentTime = curTime;
            this.currentFrameIndex = nowFrame;
        }
    }

    render(bones: spine.Bone[], slots: spine.Slot[], updator: IVBIBUpdate, curTime: number, boneMat: Float32Array) {
        //debugger;
        this.renderWithOutMat(slots, updator, curTime);
        this.currentSKin.updateBoneMat(curTime, this.animator, bones, this.state, boneMat);
    }
}
