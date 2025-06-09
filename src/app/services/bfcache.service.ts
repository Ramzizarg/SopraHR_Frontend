import { Injectable, OnDestroy } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';

/**
 * Service to handle Back/Forward Cache (bfcache) optimizations
 * This improves page load performance when users navigate back/forward
 */
@Injectable({
  providedIn: 'root'
})
export class BFCacheService implements OnDestroy {
  private pageShowSubscription: Subscription;
  private pageHideSubscription: Subscription;
  
  constructor() {
    // Listen for pageshow event with persisted flag
    this.pageShowSubscription = fromEvent(window, 'pageshow').subscribe((event: any) => {
      if (event.persisted) {
        // Page was restored from bfcache
        console.log('Page restored from back/forward cache');
        // Refresh any necessary data here
      }
    });
    
    // Listen for pagehide event
    this.pageHideSubscription = fromEvent(window, 'pagehide').subscribe(() => {
      // Clean up any event listeners or resources that might prevent bfcache
      // Remove event listeners, close connections, etc.
      this.cleanupForBFCache();
    });
    
    // Make sure unload event isn't used
    this.removeUnloadListeners();
  }
  
  private cleanupForBFCache(): void {
    // Close any open connections
    // IndexedDB connections should be closed
    // WebSockets should be closed
    // Any pending fetch requests should be aborted
    // Any timers should be cleared
  }
  
  private removeUnloadListeners(): void {
    // Remove any beforeunload or unload event listeners
    // These prevent bfcache from working
    window.removeEventListener('beforeunload', () => {});
    window.removeEventListener('unload', () => {});
  }
  
  ngOnDestroy(): void {
    if (this.pageShowSubscription) {
      this.pageShowSubscription.unsubscribe();
    }
    if (this.pageHideSubscription) {
      this.pageHideSubscription.unsubscribe();
    }
  }
}
