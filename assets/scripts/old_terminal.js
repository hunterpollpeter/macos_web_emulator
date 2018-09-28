window.path = BrowserFS.BFSRequire('path');
var cwd = '/';
var commands = {
  cd: function(cmd) {
      if (cmd.args.length === 1) {
          var dirname = path.resolve(cwd + '/' + cmd.args[0]);
          term.pause();
          fs.stat(dirname, (err, stat) => {
              if (err) {
                  term.error("Directory doesn't exist").resume();
              } else if (stat.isFile()) {
                  term.error(`"${dirname}" is not a directory`).resume();
              } else {
                  cwd = dirname == '/' ? dirname : dirname.replace(/\/$/, '');
                  gitBranch({fs, cwd}).then(b => {
                      branch = b;
                      term.resume();
                  });
              }
          });
      }
  },
  ls: function(cmd) {
      var {options, args} = split_args(cmd.args);
      function filter(list) {
          if (options.match(/a/)) {
              return list;
          } else if (options.match(/A/)) {
              return list.filter(name => !name.match(/^\.{1,2}$/));
          } else {
              return list.filter(name => !name.match(/^\./));
          }
      }
      list(cwd + '/' + (args[0] || '')).then((content) => {
          var dirs = filter(['.', '..'].concat(content.dirs)).map((dir) => color('blue', dir));
          term.echo(dirs.concat(filter(content.files)).join('\n'));
      });
  },
  git: {
    clone: function(cmd) {
            term.pause();
            cmd.args.shift();
            var args = [];
            var options = {};
            var long;
            var re = /^--(.*)/;
            cmd.args.forEach(function(arg) {
                if (long) {
                    options[long[1]] = arg;
                } else if (!String(arg).match(re)) {
                    args.push(arg);
                }
                long = String(arg).match(re);
            });
            var depth = getOption(/^--depth/, cmd.args);
            var url = 'https://jcubic.pl/proxy.php?' + args[0];
            var re = /\/([^\/]+)(\.git)?$/;
            var repo_dir = args.length === 2 ? args[1] : args[0].match(re)[1];
            fs.stat('/' + repo_dir, function(err, stat) {
                if (err) {
                    fs.mkdir(repo_dir, function(err) { if (!err) { clone() }});
                } else if (stat) {
                    if (stat.isFile()) {
                        term.error(`"${repo_dir}" is a file`).resume();
                    } else {
                        fs.readdir('/' + repo_dir, function(err, list) {
                            if (list.length) {
                                term.error(`"${repo_dir}" exists and is not empty`).resume();
                            } else {
                                clone();
                            }
                        });
                    }
                }
            });
            var emitter = new EventEmitter();
            var index = null;
            emitter.on('message', (message) => {
                if (message.match(/Compressing/)) {
                    if (index === null) {
                        term.echo(message);
                        index = term.last_index();
                    } else {
                        term.update(index, message)
                    }
                } else {
                    term.echo(message);
                }
            });
            function clone() {
                term.echo(`Cloning into '${repo_dir}'...`);
                git.clone({
                    fs: fs,
                    dir: repo_dir,
                    url: url,
                    depth: depth ? +depth : 2,
                    singleBranch: true,
                    emitter: emitter
                }).then(() => {
                    term.echo(`clone complete`).resume();
                }).catch(error);
            }
        }
    }
}

function initialize_terminal() {
  term = $('#terminal').terminal(function(command, term) {
        var cmd = $.terminal.parse_command(command);
        if (commands[cmd.name]) {
            var action = commands[cmd.name];
            var args = cmd.args.slice();
            while (true) {
                if (typeof action == 'object' && args.length) {
                    action = action[args.shift()];
                } else {
                    break;
                }
            }
            if (action) {
                action.call(term, cmd);
            } else {
                term.error('Unknown command');
            }
        }
    }, {
      greetings: 'Hunter Pollpeter',
      name: 'terminal',
      prompt: '$ '
  });
}

function getOption(option, args) {
     option = args.reduce((acc, arg) => {
         if (typeof acc == 'string') {
             return acc;
         } else if (acc === true) {
             return arg;
         } else if (option instanceof RegExp ? arg.match(option) : arg === option) {
             return true;
         }
         return false;
     }, false);
     return option === true ? false : option;
}

function split_args(args) {
    return {
        options: args.filter(arg => arg.match(/^-/)).join('').replace(/-/g, ''),
        args: args.filter(arg => !arg.match(/^-/))
    };
}

function list(path) {
    term.pause();
    return listDir(path).then((list) => (term.resume(), list));
}

function listDir(path) {
    return new Promise(function(resolve, reject) {
        fs.readdir(path, function(err, dirList) {
            if (err) {
                return reject(err);
            }
            var result = {
                files: [],
                dirs: []
            };
            var len = dirList.length;
            if (!len) {
                resolve(result);
            }
            dirList.forEach(function(filename) {
                var file = (path === '/' ? '' : path) + '/' + filename;

                fs.stat(file, function(err, stat) {
                    if (stat) {
                        result[stat.isFile() ? 'files' : 'dirs'].push(filename);
                    }
                    if (!--len) {
                        resolve(result);
                    }
                });
            });

        });
    });
}

function color(name, string) {
    var colors = {
        blue:   '#55f',
        green:  '#4d4',
        grey:   '#999',
        red:    '#A00',
        yellow: '#FF5',
        violet: '#a320ce',
        white:  '#fff',
        'persian-green': '#0aa'
    };
    if (colors[name]) {
        return '[[;' + colors[name] + ';]' + string + ']';
    } else {
        return string;
    }
}

async function gitBranch({fs, cwd}) {
    try {
        var dir = await gitroot(cwd);
        return git.currentBranch({fs, dir});
    } catch(e) {
    }
}
