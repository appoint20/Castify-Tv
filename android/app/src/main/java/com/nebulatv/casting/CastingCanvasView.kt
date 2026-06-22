package com.nebulatv.casting

import android.content.Context
import android.util.AttributeSet
import android.view.TextureView
import android.widget.FrameLayout

class CastingCanvasView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    enum class ScalingMode {
        ASPECT_FIT,
        ASPECT_FILL
    }

    private val textureView: TextureView = TextureView(context)
    private var videoWidth = 1920
    private var videoHeight = 1080
    private var scalingMode = ScalingMode.ASPECT_FIT

    init {
        addView(textureView)
    }

    fun setVideoSize(width: Int, height: Int) {
        if (videoWidth != width || videoHeight != height) {
            videoWidth = width
            videoHeight = height
            requestLayout()
        }
    }

    fun setScalingMode(mode: ScalingMode) {
        if (scalingMode != mode) {
            scalingMode = mode
            requestLayout()
        }
    }

    fun getTextureView(): TextureView = textureView

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val parentWidth = MeasureSpec.getSize(widthMeasureSpec)
        val parentHeight = MeasureSpec.getSize(heightMeasureSpec)

        if (videoWidth == 0 || videoHeight == 0) {
            super.onMeasure(widthMeasureSpec, heightMeasureSpec)
            return
        }

        val videoAspectRatio = videoWidth.toFloat() / videoHeight.toFloat()
        val parentAspectRatio = parentWidth.toFloat() / parentHeight.toFloat()

        var finalWidth = parentWidth
        var finalHeight = parentHeight

        when (scalingMode) {
            ScalingMode.ASPECT_FIT -> {
                // Fit inside parent bounds (letterbox / pillarbox)
                if (videoAspectRatio > parentAspectRatio) {
                    finalHeight = (parentWidth / videoAspectRatio).toInt()
                } else {
                    finalWidth = (parentHeight * videoAspectRatio).toInt()
                }
            }
            ScalingMode.ASPECT_FILL -> {
                // Fill parent bounds and crop excess (zoom / crop)
                if (videoAspectRatio > parentAspectRatio) {
                    finalWidth = (parentHeight * videoAspectRatio).toInt()
                } else {
                    finalHeight = (parentWidth / videoAspectRatio).toInt()
                }
            }
        }

        // Measure textureView with final size
        val textureWidthSpec = MeasureSpec.makeMeasureSpec(finalWidth, MeasureSpec.EXACTLY)
        val textureHeightSpec = MeasureSpec.makeMeasureSpec(finalHeight, MeasureSpec.EXACTLY)
        textureView.measure(textureWidthSpec, textureHeightSpec)

        // FrameLayout measures itself to fill parent bounds
        setMeasuredDimension(parentWidth, parentHeight)
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        val width = right - left
        val height = bottom - top

        val childWidth = textureView.measuredWidth
        val childHeight = textureView.measuredHeight

        // Center the textureView
        val childLeft = (width - childWidth) / 2
        val childTop = (height - childHeight) / 2

        textureView.layout(childLeft, childTop, childLeft + childWidth, childTop + childHeight)
    }
}
