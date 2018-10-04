$(function() {
  $('#desktop').mousedown(function() {
    $('.icon').removeClass('icon-selected');
  });

  createWindows();

  set_windowStack();

  $('.draggable').each(function(i) {
    $(this).iconify();
    dragableElement(this);
  });
  $('.resizable').each(function(i) {
    resizableElement(this);
  });
});

function createWindows() {
  // set active window
  $('.window').mousedown(function(e) {
    $('.window').removeClass('active');
    $(this).addClass('active');
    windowStack();
  });
  $('.window').prepend("<div class='resizers'><div class='resizer top-left'></div><div class='resizer top-right'></div><div class='resizer bottom-left'></div><div class='resizer bottom-right'></div></div>");
  $('.window .header').prepend("<div class='buttons'><div class='button close'><a class='closebutton' href='#''><span>x</span></a></div><div class='button minimize'><a class='minimizebutton' href='#'><span>&ndash;</span></a></div><div class='button zoom'><a class='zoombutton' href='#'><span>+</span></a></div></div>");
  $('.window .closebutton').click(function(e) {
    e.preventDefault();
    parentWindow_recursive(e.currentTarget).remove();
  });
  $('.window .zoombutton').click(function(e) {
    e.preventDefault();
    $(parentWindow_recursive(e.currentTarget)).toggleClass('zoomed');
  });
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

// folder stuff
async function syncFolder(path) {
  var items = await listDir(path);
  var curr_folders = $('#desktop').children('.icon').has('.folder').map(function() {
    return ('#' + this.id);
  }).get();
  var folders = [];

  // create folders that do not exist yet
  items.dirs.forEach(function (dir) {
    var id = '#folder_' + dir.replace(/ /g,"_");
    if (!curr_folders.includes(id)) {
      createFolder(dir);
    }
    folders.push(id);
  });

  // remove folders that do not exist at all
  $('#desktop').children('.icon').has('.folder').not(folders.join()).remove();
}

function createFolder(name) {
  var safe_name = name.replace(/ /g,"_");
  var $folder = $('<div id="folder_' + safe_name + '" class="icon draggable" name="' + name + '"><div class="icon-image folder"></div><div class="icon-name"><span>' + name + '</span></div></div>');
  dragableElement($folder[0]);
  $folder.iconify();
  $('#desktop').append($folder);
}

function createWindow(name) {
  var safe_name = name.replace(/ /g,"_");
  var $window = $('<div id="window_' + safe_name + '" class="window resizable draggable" name="' + name + '"><div class="header"><span class="windowtitle">' + name + '</span></div><div class="content">content</div></div>');
  $window.prepend("<div class='resizers'><div class='resizer top-left'></div><div class='resizer top-right'></div><div class='resizer bottom-left'></div><div class='resizer bottom-right'></div></div>");
  var $header = $window.children('.header');
  $header.prepend("<div class='buttons'><div class='button close'><a class='closebutton' href='#''><span>x</span></a></div><div class='button minimize'><a class='minimizebutton' href='#'><span>&ndash;</span></a></div><div class='button zoom'><a class='zoombutton' href='#'><span>+</span></a></div></div>");
  $window.mousedown(function(e) {
    setActiveWindow($(this));
  });
  $header.find('.closebutton').click(function(e) {
    e.preventDefault();
    parentWindow_recursive(e.currentTarget).remove();
  });
  $header.find('.zoombutton').click(function(e) {
    e.preventDefault();
    $(parentWindow_recursive(e.currentTarget)).toggleClass('zoomed');
  });
  dragableElement($window[0]);
  resizableElement($window[0]);
  return $window;
}

function openFolder(name) {
  $window = $("[name='" + name + "'].window");
  if ($window.length == 0) {
    $window = createWindow(name);
    $('#desktop').append($window);
  }
  setActiveWindow($window);
}

function setActiveWindow(element) {
  $window = element.filter('.window');
  $('.window').removeClass('active');
  $window.addClass('active');
  windowStack();
}

// jquery extensions
jQuery.fn.extend({
  iconify: function() {
    var $this = this.filter('.icon');
    return $this.dblclick(function() {
      openFolder($this.attr('name'));
    })
    .mousedown(function() {
      $('.icon').removeClass('icon-selected');
      $this.addClass('icon-selected');
      clearTimeout(this.downTimer);
      this.downTimer = setTimeout(function() {
        $this.addClass('icon-dragging');
      }, 75);
      return false;
    })
    .mouseup(function() {
      clearTimeout(this.downTimer);
      $this.removeClass('icon-dragging');
    });
  }
});
