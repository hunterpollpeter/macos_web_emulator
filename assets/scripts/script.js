$(function() {
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
    $(parentWindow_recursive(e.currentTarget)).css({top: 0, left: 0, right : 0, bottom: 0, width: "", height: ""}); 
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

function parentWindow_recursive(element) {
  element = element.parentElement;
  if (element.classList.contains('window')) {
    return element;
  }
  return parentWindow_recursive(element);
}
