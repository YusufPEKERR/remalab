package com.erp.webapp

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var siteManager: SiteManager
    private lateinit var siteSpinner: Spinner
    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var topBarContainer: LinearLayout

    private var currentConfig: SitesConfig = SitesConfig()
    private var currentSite: SiteItem? = null
    private var isSettingSpinnerProgrammatically = false

    // Auto-Hide & Gesture Variables
    private var isTopBarVisible = true
    private val autoHideHandler = Handler(Looper.getMainLooper())
    private val autoHideRunnable = Runnable { hideTopBar() }
    private val autoHideDelayMs = 5000L

    private var twoFingerStartY = 0f
    private var isTrackingTwoFinger = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        siteManager = SiteManager(this)

        topBarContainer = findViewById(R.id.topBarContainer)
        siteSpinner = findViewById(R.id.siteSpinner)
        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        progressBar = findViewById(R.id.progressBar)

        setupWebView()
        setupButtons()
        setupBackPressed()

        swipeRefresh.setOnRefreshListener {
            resetAutoHideTimer()
            webView.reload()
        }

        loadConfigAndSetupSpinner()

        // Start initial auto-hide timer (5 seconds)
        resetAutoHideTimer()
    }

    override fun onResume() {
        super.onResume()
        loadConfigAndSetupSpinner()
        resetAutoHideTimer()
    }

    override fun onPause() {
        super.onPause()
        autoHideHandler.removeCallbacks(autoHideRunnable)
    }

    // Intercept touch events anywhere on the screen for 2-finger swipe down gesture & resetting inactivity timer
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (isTopBarVisible) {
            resetAutoHideTimer()
        }

        when (ev.actionMasked) {
            MotionEvent.ACTION_POINTER_DOWN -> {
                if (ev.pointerCount == 2) {
                    twoFingerStartY = (ev.getY(0) + ev.getY(1)) / 2f
                    isTrackingTwoFinger = true
                }
            }
            MotionEvent.ACTION_MOVE -> {
                if (isTrackingTwoFinger && ev.pointerCount >= 2) {
                    val currentY = (ev.getY(0) + ev.getY(1)) / 2f
                    val deltaY = currentY - twoFingerStartY
                    
                    // User swiped 2 fingers downward by more than 50 pixels
                    if (deltaY > 50f) {
                        showTopBar()
                        isTrackingTwoFinger = false
                    }
                }
            }
            MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (ev.pointerCount <= 2) {
                    isTrackingTwoFinger = false
                }
            }
        }

        return super.dispatchTouchEvent(ev)
    }

    private fun showTopBar() {
        if (!isTopBarVisible) {
            isTopBarVisible = true
            topBarContainer.visibility = View.VISIBLE
            topBarContainer.animate()
                .translationY(0f)
                .setDuration(300)
                .start()
        }
        resetAutoHideTimer()
    }

    private fun hideTopBar() {
        if (isTopBarVisible) {
            isTopBarVisible = false
            autoHideHandler.removeCallbacks(autoHideRunnable)
            val hideDistance = -topBarContainer.height.toFloat().coerceAtLeast(-300f)
            topBarContainer.animate()
                .translationY(hideDistance)
                .setDuration(300)
                .withEndAction {
                    topBarContainer.visibility = View.INVISIBLE
                }
                .start()
        }
    }

    private fun resetAutoHideTimer() {
        autoHideHandler.removeCallbacks(autoHideRunnable)
        if (isTopBarVisible) {
            autoHideHandler.postDelayed(autoHideRunnable, autoHideDelayMs)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }
        }
    }

    private fun setupButtons() {
        val btnReload: ImageButton = findViewById(R.id.btnReload)
        btnReload.setOnClickListener {
            resetAutoHideTimer()
            webView.reload()
        }

        val btnHome: ImageButton = findViewById(R.id.btnHome)
        btnHome.setOnClickListener {
            resetAutoHideTimer()
            val defaultSite = siteManager.getDefaultSite(currentConfig)
            if (defaultSite != null) {
                loadSite(defaultSite)
                selectSpinnerItemForSite(defaultSite)
            }
        }

        val btnSettings: ImageButton = findViewById(R.id.btnSettings)
        btnSettings.setOnClickListener {
            resetAutoHideTimer()
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    private fun setupBackPressed() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (!isTopBarVisible) {
                    // Show top bar on first back press if hidden
                    showTopBar()
                } else if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun loadConfigAndSetupSpinner() {
        currentConfig = siteManager.loadConfig()
        val sites = currentConfig.sites

        if (sites.isEmpty()) {
            Toast.makeText(this, "Kayıtlı web sitesi bulunamadı. Lütfen Ayarlar'dan site ekleyin.", Toast.LENGTH_LONG).show()
            return
        }

        val spinnerItems = sites.map { site ->
            if (site.id == currentConfig.default_site_id) {
                "⭐ ${site.name}"
            } else {
                "🌐 ${site.name}"
            }
        }

        val spinnerAdapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            spinnerItems
        )
        spinnerAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        
        siteSpinner.onItemSelectedListener = null
        isSettingSpinnerProgrammatically = true
        siteSpinner.adapter = spinnerAdapter

        val defaultSite = siteManager.getDefaultSite(currentConfig)
        if (defaultSite != null) {
            selectSpinnerItemForSite(defaultSite)
            if (currentSite == null || !sites.any { it.id == currentSite?.id }) {
                loadSite(defaultSite)
            }
        }
        isSettingSpinnerProgrammatically = false

        siteSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                if (isSettingSpinnerProgrammatically) return
                resetAutoHideTimer()
                if (position in sites.indices) {
                    val selectedSite = sites[position]
                    if (currentSite?.id != selectedSite.id) {
                        loadSite(selectedSite)
                    }
                }
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
    }

    private fun selectSpinnerItemForSite(site: SiteItem) {
        val index = currentConfig.sites.indexOfFirst { it.id == site.id }
        if (index != -1 && index != siteSpinner.selectedItemPosition) {
            isSettingSpinnerProgrammatically = true
            siteSpinner.setSelection(index)
            isSettingSpinnerProgrammatically = false
        }
    }

    private fun loadSite(site: SiteItem) {
        currentSite = site
        var url = site.url
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://$url"
        }
        webView.loadUrl(url)
    }
}
