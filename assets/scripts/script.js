$(function() {
  $('#desktop').mousedown(function() {
    $('.icon').removeClass('icon-selected');
  });

  createWindows();

  set_windowStack();

  BrowserFSConfigure().then(function() {
    syncFolder('/');
  });

  $terminal_icon = createIcon('terminal', 'terminal_icon', 'assets/images/terminal.png', function(){ return openTerminal() });
  $('#desktop').append($terminal_icon);

  openTerminal()
});

function createWindows() {
  // set active window
  $('.window').mousedown(function(e) {
    $('.window').removeClass('active');
    $(this).addClass('active');
    windowStack();
  });
  $('.window').prepend("<div class='resizers'><div class='resizer top-left'></div><div class='resizer top-right'></div><div class='resizer bottom-left'></div><div class='resizer bottom-right'></div></div>");
  $('.window .header').prepend("<div class='buttons'><div class='button close'><span class='closebutton'>x</span></div><div class='button minimize'><span class='minimizebutton'>&ndash;</span></div><div class='button zoom'><span class='zoombutton'>+</span></div></div>");
  $('.window .close').click(function(e) {
    e.preventDefault();
    parentWindow_recursive(e.currentTarget).remove();
  });
  $('.window .zoom').click(function(e) {
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
  if (!element.hasClass('zoomed')) { return; }
  element.removeClass('zoomed');
  element.css({
    top: 0,
    left: 0,
    right: "",
    bottom: "",
    width: "100%",
    height: "100%"
  });
}

// folder stuff
async function syncFolder(path) {
  var items = await listDir(path);
  var curr_folders = $('#desktop > .icon.folder').map(function() {
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
  $('#desktop > .icon.folder').not(folders.join()).remove();
}

function createFolder(name) {
  var id = `folder_${name.replace(/ /g,"_")}`;
  $folder = createIcon(name, id, 'assets/images/folder.png', function(){ return openFolder(name) });
  $('#desktop').append($folder);
}

function createIcon(name, id, img, dblclick) {
  return  $(`
    <div id='${id}' class='icon folder' name='${name}'>
      <img src="${img}" class='icon-image'/>
      <div class="icon-name">
        <span>${name}</span>
      </div>
    </div>`)
  .dblclick(function() {
    dblclick();
  })
  .mousedown(function() {
    $('.icon').removeClass('icon-selected');
    $(this).addClass('icon-selected');
    clearTimeout(this.downTimer);
    this.downTimer = setTimeout(function() {
      $(this).addClass('icon-dragging');
    }, 75);
    return false;
  })
  .mouseup(function() {
    clearTimeout(this.downTimer);
    $(this).removeClass('icon-dragging');
  })
  .draggable({
    addClasses: false,
    helper: "clone",
    opacity: 0.6,
    stop: function(e, ui) {
      $(e.target).css(ui.position);
    }
  });
}

function createWindow(name, content) {
  var safe_name = name.replace(/ /g,"_");
  var $window = $(`
    <div id="window_${safe_name}" class="window resizable" name="${name}">
      <div class="header">
        <span class="windowtitle">${name}</span>
      </div>
      <div class="content"></div>
    </div>`);
  $window.prepend(`
    <div class='resizers'>
      <div class='resizer top-left'></div>
      <div class='resizer top-right'></div>
      <div class='resizer bottom-left'></div>
      <div class='resizer bottom-right'></div>
    </div>`)
  .mousedown(function(e) {
      setActiveWindow($(this));
  });

  var $header = $window.children('.header');
  $header.prepend(`
    <div class='buttons'>
      <div class='button close'>
        <span class='closebutton'>x</span>
      </div>
      <div class='button minimize'>
        <span class='minimizebutton'>&ndash;</span>
      </div>
      <div class='button zoom'>
        <span class='zoombutton'>+</span>
      </div>
    </div>`);
  $header.find('.close').click(function(e) {
    e.preventDefault();
    parentWindow_recursive(e.currentTarget).remove();
  });
  $header.find('.zoom').click(function(e) {
    e.preventDefault();
    $(parentWindow_recursive(e.currentTarget)).toggleClass('zoomed');
  });

  var $content = $window.children('.content');
  $content.append(content);

  $window.draggable({
    addClasses: false,
    handle: $header
  }).css("position", "absolute");

  return $window;
}

function openFolder(name) {
  $window = $("[name='" + name + "'].window");
  $content = $(`<p>contents of "${name}" folder</p>`);
  if ($window.length == 0) {
    $window = createWindow(name, $content);
    $('#desktop').append($window);
  }
  setActiveWindow($window);
}

function openTerminal() {
  $window = $("#window_terminal");
  $content = $(`<div id="terminal"></div>`);
  if ($window.length == 0) {
    $window = createWindow('terminal', $content);
    $('#desktop').append($window);
    initializeTerminal();
  }
  setActiveWindow($window);
}

function setActiveWindow(element) {
  $window = element.filter('.window');
  $('.window').removeClass('active');
  $window.addClass('active');
  windowStack();
}
