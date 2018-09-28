jQuery(function($, undefined) {
  set_windowStack();

  $('.draggable').each(function(i) {
    dragableElement(this);
  });
  $('.resizable').each(function(i) {
    resizableElement(this);
  });

  // set active window
  $('.window').mousedown(function(e) {
    $('.window').removeClass('active');
    $(this).addClass('active');
    windowStack();
  });
});

function set_windowStack() {
  var start = 999;
  $('.window.active').css('z-index', 1000);
  $('.window:not(.active)').each(function(i) {
    $(this).css('z-index', start--);
  });
};

function windowStack() {
  $('.window.active').css('z-index', 1000);
  $('.window:not(.active)').each(function(i) {
    var $this = $(this);
    $this.css('z-index', $this.css('z-index') - 1);
  });
};
