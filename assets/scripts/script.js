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
  var $folder = $('<div id="folder_' + safe_name + '" class="icon draggable"><div class="icon-image folder"></div><div class="icon-name"><span>' + name + '</span></div></div>');
  dragableElement($folder[0]);
  $folder.iconify();
  $('#desktop').append($folder);
}

// jquery extensions
jQuery.fn.extend({
  iconify: function() {
    var $this = this.filter('.icon');
    return $this.dblclick(function() {
      console.log('double click!')
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
