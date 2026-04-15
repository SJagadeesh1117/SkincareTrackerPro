package com.jagadeesh.skincaretracker

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactRootView
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.gesturehandler.react.RNGestureHandlerEnabledRootView

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "SkincareTrackerPro"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
        override fun createRootView(): ReactRootView =
          RNGestureHandlerEnabledRootView(this@MainActivity)
      }
}
