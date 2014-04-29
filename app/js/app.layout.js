app.layout = {
  init: function() {
    gapi.hangout.layout.setChatPaneVisible(false);
    this.updateScrollbar();
  },

  /**
   * Updates scroll panes on the page
   */
  updateScrollbar: function() {
    setTimeout(function() {
      $('.nano:visible').nanoScroller({alwaysVisible: true});
    }, 0);
  }
};