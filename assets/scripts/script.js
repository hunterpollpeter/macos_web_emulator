$(function() {
  createWindows();

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

  $('.closebutton').click(function(e) {
    e.preventDefault();
    parentWindow_recursive(e.currentTarget).remove();
  });

  $('.zoombutton').click(function(e) {
    e.preventDefault();
    $(parentWindow_recursive(e.currentTarget)).toggleClass('zoomed');
  });
});

function createWindows() {
  $('.window').prepend("<div class='resizers'><div class='resizer top-left'></div><div class='resizer top-right'></div><div class='resizer bottom-left'></div><div class='resizer bottom-right'></div></div>");
  $('.window .header').prepend("<div class='buttons'><div class='button close'><a class='closebutton' href='#''><span>x</span></a></div><div class='button minimize'><a class='minimizebutton' href='#'><span>&ndash;</span></a></div><div class='button zoom'><a class='zoombutton' href='#'><span>+</span></a></div></div>");
}

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

function parentWindow_recursive(element) {
  element = element.parentElement;
  if (element.classList.contains('window')) {
    return element;
  }
  return parentWindow_recursive(element);
}

function setToZoomed(element) {
  $element = $(element);
  if (!$element.hasClass('zoomed')) { return; }
  $element.removeClass('zoomed');
  $element.css({top: 0, left: 0, right: "", bottom: "", width: "100%", height: "100%"});
}
