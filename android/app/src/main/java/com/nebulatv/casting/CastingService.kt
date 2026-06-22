package com.nebulatv.casting

import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Binder
import android.os.IBinder
import android.util.Log
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CastingService : Service() {

    private val binder = CastingBinder()
    private var nsdManager: NsdManager? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var serverSocket: ServerSocket? = null
    private var executorService: ExecutorService? = null
    private var isRunning = false

    companion object {
        private const val TAG = "CastingService"
        private const val SERVICE_TYPE = "_airplay._tcp"
        private const val SERVICE_NAME = "Castify TV Receiver"
        private const val PORT = 7000
    }

    inner class CastingBinder : Binder() {
        fun getService(): CastingService = this@CastingService
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "CastingService created")
        nsdManager = getSystemService(Context.NSD_SERVICE) as NsdManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "CastingService starting")
        startCastingServer()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder {
        Log.d(TAG, "CastingService bound")
        return binder
    }

    private fun startCastingServer() {
        if (isRunning) return
        isRunning = true
        executorService = Executors.newCachedThreadPool()

        // 1. Register mDNS NSD Service
        registerNsdService()

        // 2. Start Socket Server in background thread
        executorService?.execute {
            try {
                serverSocket = ServerSocket(PORT)
                Log.d(TAG, "Socket Server listening on port $PORT")
                while (isRunning) {
                    val clientSocket = serverSocket?.accept()
                    if (clientSocket != null) {
                        Log.d(TAG, "New client connected: ${clientSocket.remoteSocketAddress}")
                        executorService?.execute {
                            handleClientStream(clientSocket)
                        }
                    }
                }
            } catch (e: IOException) {
                Log.e(TAG, "ServerSocket error: ${e.message}")
            }
        }
    }

    private fun registerNsdService() {
        val serviceInfo = NsdServiceInfo().apply {
            serviceName = SERVICE_NAME
            serviceType = SERVICE_TYPE
            port = PORT
            // AirPlay / Cast compatibility attributes
            setAttribute("deviceid", "AA:BB:CC:DD:EE:FF")
            setAttribute("features", "0x7")
            setAttribute("model", "AppleTV2,1")
            setAttribute("srcvers", "101.28")
        }

        registrationListener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(registeredServiceInfo: NsdServiceInfo) {
                Log.d(TAG, "NSD Service successfully registered: ${registeredServiceInfo.serviceName}")
            }

            override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(TAG, "NSD Service registration failed with code: $errorCode")
            }

            override fun onServiceUnregistered(arg0: NsdServiceInfo) {
                Log.d(TAG, "NSD Service successfully unregistered")
            }

            override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                Log.e(TAG, "NSD Service unregistration failed with code: $errorCode")
            }
        }

        try {
            nsdManager?.registerService(
                serviceInfo,
                NsdManager.PROTOCOL_DNS_SD,
                registrationListener
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register NSD Service: ${e.message}")
        }
    }

    private fun handleClientStream(socket: Socket) {
        try {
            val inputStream = socket.getInputStream()
            val buffer = ByteArray(4096)
            var bytesRead: Int
            while (isRunning && inputStream.read(buffer).also { bytesRead = it } != -1) {
                // Intercept raw H.264 video streams or JPEG image buffers.
                // In a full production implementation, this data would feed into a decoder pipeline.
                Log.v(TAG, "Received $bytesRead bytes of casting data")
            }
        } catch (e: IOException) {
            Log.d(TAG, "Client socket disconnected: ${e.message}")
        } finally {
            try {
                socket.close()
            } catch (e: IOException) {
                // Ignore
            }
        }
    }

    private fun stopCastingServer() {
        if (!isRunning) return
        isRunning = false
        Log.d(TAG, "Stopping Casting Server...")

        // Close sockets
        try {
            serverSocket?.close()
        } catch (e: IOException) {
            Log.e(TAG, "Error closing ServerSocket: ${e.message}")
        }
        serverSocket = null

        // Unregister NSD service
        try {
            registrationListener?.let {
                nsdManager?.unregisterService(it)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering NSD service: ${e.message}")
        }
        registrationListener = null

        // Shutdown thread pool executor
        executorService?.shutdownNow()
        executorService = null
    }

    override fun onDestroy() {
        Log.d(TAG, "CastingService destroyed")
        stopCastingServer()
        super.onDestroy()
    }
}
