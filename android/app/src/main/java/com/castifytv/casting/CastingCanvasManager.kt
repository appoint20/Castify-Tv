package com.castifytv.casting

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class CastingCanvasManager : SimpleViewManager<CastingCanvasView>() {
    
    override fun getName(): String = "CastingCanvas"

    override fun createViewInstance(reactContext: ThemedReactContext): CastingCanvasView {
        return CastingCanvasView(reactContext)
    }

    @ReactProp(name = "scalingMode")
    fun setScalingMode(view: CastingCanvasView, scalingMode: String?) {
        val mode = when (scalingMode) {
            "aspectFill" -> CastingCanvasView.ScalingMode.ASPECT_FILL
            else -> CastingCanvasView.ScalingMode.ASPECT_FIT
        }
        view.setScalingMode(mode)
    }

    @ReactProp(name = "videoSize")
    fun setVideoSize(view: CastingCanvasView, sizeMap: com.facebook.react.bridge.ReadableMap?) {
        if (sizeMap != null && sizeMap.hasKey("width") && sizeMap.hasKey("height")) {
            val w = sizeMap.getInt("width")
            val h = sizeMap.getInt("height")
            view.setVideoSize(w, h)
        }
    }
}
