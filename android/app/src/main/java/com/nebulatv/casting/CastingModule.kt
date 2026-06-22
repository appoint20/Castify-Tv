package com.nebulatv.casting

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CastingModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CastingModule"

    @ReactMethod
    fun startCastingServer() {
        val context = reactApplicationContext
        val intent = Intent(context, CastingService::class.java)
        context.startService(intent)
    }

    @ReactMethod
    fun stopCastingServer() {
        val context = reactApplicationContext
        val intent = Intent(context, CastingService::class.java)
        context.stopService(intent)
    }
}
