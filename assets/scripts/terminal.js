/**@license
 *   ___ ___ _____  __      __   _      _____              _           _
 *  / __|_ _|_   _| \ \    / /__| |__  |_   _|__ _ _ _ __ (_)_ _  __ _| |
 * | (_ || |  | |    \ \/\/ / -_) '_ \   | |/ -_) '_| '  \| | ' \/ _` | |
 *  \___|___| |_|     \_/\_/\___|_.__/   |_|\___|_| |_|_|_|_|_||_\__,_|_|
 *
 * Copyright (c) 2018 Jakub Jankiewicz <http://jcubic.pl/me>
 * Released under the MIT license
 *
 */
BrowserFS.configure({ fs: 'IndexedDB', options: {} }, function (err) {
    function greetings() {
        var title = '[[;#fff;]terminal @ hunterpollpeter.com]';
        return title + '\n' + 'use [[;#fff;]help] to see the available commands' +
               ' or [[;#fff;]credits] to list the projects used\n';
    }
    var name = 'git'; // terminal name for history
    if (err) {
        return $('.term').terminal(function(command, term) {
            term.error('BrowserFS was not initialized');
        }, {greetings: false, name}).echo(greetings).error(err.message || err);
    }
    window.fs = BrowserFS.BFSRequire('fs');
    window.path = BrowserFS.BFSRequire('path');
    if ('serviceWorker' in navigator) {
        var scope = location.pathname.replace(/\/[^\/]+$/, '/');
        if (!scope.match(/__browserfs__/)) {
            navigator.serviceWorker.register('sw.js', {scope})
                     .then(function(reg) {
                         reg.addEventListener('updatefound', function() {
                             var installingWorker = reg.installing;
                             console.log('A new service worker is being installed:',
                                         installingWorker);
                         });
                         // registration worked
                         console.log('Registration succeeded. Scope is ' + reg.scope);
                     }).catch(function(error) {
                         // registration failed
                             console.log('Registration failed with ' + error);
                     });
        }
    }
    var dir = '/';
    var cwd = '/';
    var branch;
    // -----------------------------------------------------------------------------------------------------
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
    // -----------------------------------------------------------------------------------------------------
    function messageEmitter() {
        var emitter = new EventEmitter();
        emitter.on('message', (message) => {
            term.echo(message);
        });
        return emitter;
    }
    // -----------------------------------------------------------------------------------------------------
    function list(path) {
        term.pause();
        return listDir(path).then((list) => (term.resume(), list));
    }

    // -----------------------------------------------------------------------------------------------------
    // return path for cd
    function get_path(string) {
        var path = cwd.replace(/^\//, '').split('/');
        if (path[0] === '') {
            path = path.slice(1);
        }
        var parts = string === '/'
        ? string.split('/')
        : string.replace(/\/?[^\/]*$/, '').split('/');
        if (parts[0] === '') {
            parts = parts.slice(1);
        }
        if (string === '/') {
            return [];
        } else if (string.startsWith('/')) {
            return parts;
        } else if (path.length) {
            return path.concat(parts);
        } else {
            return parts;
        }
    }
    // -----------------------------------------------------------------------------------------------------
    function read(cmd, cb, raw) {
        var filename = typeof cmd === 'string' ? cmd : cmd.args.length == 1 ? cwd + '/' + cmd.args[0] : null;
        if (filename) {
            fs.readFile(filename, function(err, data) {
                if (err) {
                    term.error(err.message);
                } else {
                    var text = data.toString('utf8').replace(/\n$/, '');
                    var m = filename.match(/\.([^.]+)$/);
                    if (m) {
                        var language = m[1];
                    }
                    if (!raw && language && Prism.languages[language]) {
                        var grammar = Prism.languages[language];
                        var tokens = Prism.tokenize(file, grammar);
                        text = Prism.Token.stringify(tokens, language);
                    }
                    cb(text);
                }
            });
        }
    }
    // -----------------------------------------------------------------------------------------------------
    function split_args(args) {
        return {
            options: args.filter(arg => arg.match(/^-/)).join('').replace(/-/g, ''),
            args: args.filter(arg => !arg.match(/^-/))
        };
    }
    // -----------------------------------------------------------------------------------------------------
    function processGitFiles(files) {
        return gitroot(cwd).then((dir) => {
            var re = new RegExp('^' + dir + '/');
            return {
                files: files.map(filepath => path.resolve(cwd + '/' + filepath).replace(re, '')),
                dir
            };
        });
    }
    // -----------------------------------------------------------------------------------------------------
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
    // -----------------------------------------------------------------------------------------------------
    function getAllStats({fs, cwd, branch}) {
        function notGitDir(name) {
            return !name.match(/^\.git\/?/);
        }
        return gitroot(cwd).then((dir) => {
            return Promise.all([listBranchFiles({fs, dir, branch}), listDir(dir)]).then(([tracked, rest]) => {
                var re = new RegExp('^' + dir);
                rest = rest.files.map(path => path.replace(re, ''));
                return Promise.all(union(tracked, rest).filter(notGitDir).map(filepath => {
                    return git.status({fs, dir, filepath}).then(status => {
                        return [filepath, status];
                    });
                }));
            });
        });
    }
    // -----------------------------------------------------------------------------------------------------
    function gitAddAll({fs, dir, branch, all}) {
        return getAllStats({fs, cwd: dir, branch}).then((files) => {
            var skip_status = ['unmodified', 'ignored', 'modified', 'deleted', 'added', 'absent'];
            if (!all) {
                skip_status.push('*added');
            }
            return files.filter(([_, status]) => !skip_status.includes(status));
        }).then((files) => {
            return Promise.all(files.map(([filepath, status]) => git.add({fs, dir, filepath})));
        });
    }
    const error = (e) => term.error(e.message || e).resume();
    var commands = {
      mkdir: function(cmd) {
            if (cmd.args.length > 0) {
                var options = [];
                var args = [];
                cmd.args.forEach((arg) => {
                    var m = arg.match(/^-([^\-].*)/);
                    if (m) {
                        options = options.concat(m[1].split(''));
                    } else {
                        args.push(arg);
                    }
                });
                if (args.length) {
                    term.pause();
                    Promise.all(args.map(dir => {
                        dir = dir[0] === '/' ? dir : path.join(cwd, dir);
                        return mkdir(dir, options.includes('p'))
                    })).then(term.resume).catch(error);
                }
            }
        },
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
                      gitBranch({cwd}).then(b => {
                          branch = b;
                          term.resume();
                      });
                  }
              });
          }
        },
        vi: function(cmd) {
            var textarea = $('.vi');
            var editor;
            var fname = cmd.args[0];
            if (typeof fname !== 'string') {
                fname = String(fname);
            }
            term.focus(false);
            if (fname) {
                var path;
                if (fname.match(/^\//)) {
                    path = fname;
                } else {
                    path = (cwd === '/' ? '' : cmd) + '/' + fname;
                }
                function open(file) {
                    // we need to replace < and & because jsvi is handling html tags
                    // and don't work properly for raw text
                    textarea.val(file.replace(/</g, '&lt;').replace(/&/g, '&amp;'));
                    editor = window.editor = vi(textarea[0], {
                        color: '#ccc',
                        backgroundColor: '#000',
                        onSave: function() {
                            var file = textarea.val().replace(/&amp;/g, '&').replace(/&lt;/g, '<');
                            fs.writeFile(path, file, function(err, wr) {
                                if (err) {
                                    term.error(err.message);
                                }
                            });
                        },
                        onExit: term.focus
                    });
                }
                fs.stat(path, (err, stat) => {
                    if (stat && stat.isFile()) {
                        read(cmd, open, true);
                    } else {
                        var dir = path.replace(/[^\/]+$/, '');
                        fs.stat(dir, (err, stat) => {
                            if (stat && stat.isDirectory()) {
                                open('')
                            } else if (err) {
                                term.error(err.message);
                            } else {
                                term.error(`${dir} directory don't exists`);
                            }
                        });
                    }
                });
            }
        },
        cat: function(cmd) {
            read(cmd, term.echo);
        },
        less: function(cmd) {
            read(cmd, term.less.bind(term));
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
                term.echo(dirs.concat(filter(content.files)));
            });
        },
        clean: function() {
            term.push(function(yesno) {
                if (yesno.match(/^y(es)?$/i)) {
                    fs.getRootFS().empty();
                }
                if (yesno.match(/^(y(es)?|n(o)?)$/i)) {
                    term.pop();
                }
            }, {
                prompt: 'are you sure you want clean File System [Y/N]? '
            });
        },
        rm: function(cmd) {
            var {options, args} = split_args(cmd.args);

            var len = args.length;
            if (len) {
                term.pause();
            }
            args.forEach(arg => {
                var path_name = path.resolve(cwd + '/' + arg);
                fs.stat(path_name, async (err, stat) => {
                    if (err) {
                        term.error(err);
                    } else if (stat) {
                        if (stat.isDirectory()) {
                            if (options.match(/r/)) {
                                await rmdir(path_name);
                            } else {
                                term.error(`${path_name} is directory`);
                            }
                        } else if (stat.isFile()) {
                            await new Promise((resolve) => fs.unlink(path_name, resolve));
                        } else {
                            term.error(`${path_name} is invalid`);
                        }
                        if (!--len) {
                            term.resume();
                        }
                    }
                });
            });
        },
        record: function(cmd) {
            if (cmd.args[0] == 'start') {
                term.history_state(true);
            } else if (cmd.args[0] == 'stop') {
                term.history_state(false);
            } else {
                term.echo('usage: record [stop|start]');
            }
        },
        git: {
            reset: async function(cmd) {
                cmd.args.shift();
                term.pause();
                const hard = cmd.args.includes('--hard');
                try {
                    var dir = await gitroot(cwd);
                    const ref = cmd.args.filter(arg => arg.match(/^HEAD/))[0];
                    if (ref) {
                        await gitReset({fs, dir, hard, ref, branch});
                        const commits = await git.log({fs, dir, depth: 1});
                        const commit = commits.pop();
                        const head = await git.resolveRef({fs, dir, ref: 'HEAD'});
                        term.echo(`HEAD is now at ${commit.oid.substring(0, 7)} ${commit.message.trim()}`);
                    }
                } catch(e) {
                    term.exception(e);
                } finally {
                    term.resume();
                }
            },
            branch: function(cmd) {
                term.echo('to be implemented');
            },
            pull: async function(cmd) {
                try {
                    term.pause();
                    var dir = await gitroot(cwd);
                    var remote = 'origin';
                    var HEAD_before = await git.resolveRef({fs, dir, ref: 'HEAD'});
                    var url = await repoURL({fs, dir});
                    var output = [];
                    function messageEmitter() {
                        var emitter = new EventEmitter();
                        var first;
                        emitter.on('message', (message) => {
                            console.log(message);
                            if (message.match(/^Compressing/)) {
                                if (typeof first === 'undefined') {
                                    term.echo(message);
                                    first = term.last_index();
                                } else {
                                    term.update(first, message);
                                }
                            } else {
                                term.echo(message);
                            }
                        });
                        return emitter;
                    }
                    var ref = await git.resolveRef({
                        fs,
                        dir,
                        ref: 'HEAD',
                        depth: 1
                    });
                    await git.pull({
                        fs,
                        dir,
                        singleBranch: true,
                        fastForwardOnly: true,
                        emitter: messageEmitter()
                    });
                    // isomorphic git patch
                    const head = await git.resolveRef({
                        fs,
                        dir,
                        ref: 'HEAD',
                        depth: 1
                    });
                    console.log({head, ref});
                    if (head != ref) {
                        await new Promise((resolve) => fs.writeFile(`${dir}/.git/HEAD`, ref, resolve));
                    }
                    var HEAD_after = await git.resolveRef({fs, dir, ref: 'HEAD'});
                    console.log(JSON.stringify({HEAD_after, HEAD_before}));
                    if (HEAD_after === HEAD_before) {
                        term.echo('Already up-to-date.');
                    } else {
                        output.push(`From ${url}`);
                        output.push([
                            '   ',
                            HEAD_before.substring(0, 7),
                            '..',
                            HEAD_after.substring(0, 7),
                            '  ',
                            branch,
                            '     -> ',
                            remote,
                            '/',
                            branch
                        ].join(''));
                        output.push('Fast-froward');
                        const diffs = await gitCommitDiff({fs, dir, oldSha: HEAD_before, newSha: HEAD_after});
                        output.push(diffStat(Object.values(diffs).map(val => val.diff)));
                        term.echo(output.join('\n'));
                    }
                } catch(e) {
                    term.exception(e);
                } finally {
                    term.resume();
                }
                /* TODO:
                 *
                 * remote: Counting objects: 3, done.
                 * remote: Compressing objects: 100% (2/2), done.
                 * remote: Total 3 (delta 0), reused 3 (delta 0), pack-reused 0
                 * Unpacking objects: 100% (3/3), done.
                 * From github.com:jcubic/test
                 *    b132560..fd4588d  master     -> origin/master
                 * Updating b132560..fd4588d
                 * Fast-forward
                 *  bar | 1 +
                 *  1 file changed, 1 insertion(+)
                 */
            },
            checkout: function(cmd) {
                term.echo('to be implemented');
                /* TODO:
                 *
                 * Switched to branch 'gh-pages'
                 * Your branch is up-to-date with 'origin/gh-pages'.
                 *
                 * Switched to a new branch 'test'
                 *
                 * Switched to branch 'master'
                 * Your branch is ahead of 'origin/master' by 2 commits.
                 *   (use "git push" to publish your local commits)
                 */
            },
            add: function(cmd) {
                term.pause();
                cmd.args.shift();
                var all_git = cmd.args.filter(arg => arg.match(/^(-A|-all)$/)).length;
                var all = !!cmd.args.filter(arg => arg === '.').length;
                if (all || all_git) {
                    gitroot(cwd).then(dir => {
                        return gitAddAll({fs, dir, branch, all});
                    }).then(term.resume).catch(error);
                } else if (cmd.args.length > 0) {
                    processGitFiles(cmd.args).then(({files, dir}) => {
                        return Promise.all(files.map(filepath => git.add({fs, dir, filepath})));
                    }).then(term.resume).catch(error);
                } else {
                    term.resume();
                }
            },
            rm: function(cmd) {
                cmd.args.shift();
                var long_options = cmd.args.filter(name => name.match(/^--/));
                var {args, options} = split_args(cmd.args.filter(name => !name.match(/^--/)));
                var len = args.length;
                if (!len) {
                    term.error('Nothing to remove');
                } else {
                    term.pause();
                    gitroot(cwd).then((dir) => {
                        var re = new RegExp('^' + dir + '/');
                        args.forEach(arg => {
                            var path_name = path.resolve(cwd + '/' + arg);
                            fs.stat(path_name, (err, stat) => {
                                if (err) {
                                    term.error(err);
                                } else if (stat) {
                                    var filepath = path_name.replace(re, '');
                                    if (stat.isDirectory()) {
                                        var promise = git.listDir({fs, dir}).then((list) => {
                                            var files = list.filter(name => name.startsWith(filepath));
                                            return Promise.all(files.map(file => git.remove({fs, dir, filepath})));
                                        }).catch(err => term.error(err));
                                        if (options.match(/r/)) {
                                            if (!long_options.includes(/--cached/)) {
                                                promise.then(() => rmdir(path_name));
                                            }
                                        } else {
                                            term.error(`${path_name} is directory`);
                                        }
                                    } else if (stat.isFile()) {
                                        if (!long_options.includes(/--cached/)) {
                                            git.remove({fs, dir, filepath}).then(() => fs.unlink(path_name));
                                        } else {
                                            git.remove({fs, dir, filepath})
                                        }
                                    }
                                } else {
                                    term.error('uknown error');
                                }
                                if (!--len) {
                                    term.resume();
                                }
                            });
                        });
                    });
                }
            },
            status: function(cmd) {
                var dir = cwd.split('/')[1];
                term.pause();
                /* TODO:
                 * On branch master
                 * Your branch is ahead of 'origin/master' by 1 commit.
                 *   (use "git push" to publish your local commits)
                 *
                 * nothing to commit, working tree clean
                 */
                getAllStats({fs, cwd, branch}).then((files) => {
                    function filter(files, name) {
                        if (name instanceof Array) {
                            return files.filter(([_, status]) => name.includes(status));
                        }
                        return files.filter(([_, status]) => status === name);
                    }
                    function not(files, name) {
                        if (name instanceof Array) {
                            return files.filter(([_, status]) => !name.includes(status));
                        }
                        return files.filter(([_, status]) => status !== name);
                    }
                    var changes = not(files, ['unmodified', 'ignored']);
                    if (!changes.length) {
                        git.log({fs, dir, depth: 2, ref: branch}).then((commits) => {
                            term.echo(`On branch ${branch}`);
                            if (commits.length == 2) {
                                term.echo('nothing to commit, working directory clean\n');
                            } else {
                                // new repo
                                term.echo('nothing to commit (create/copy files and use "git add" to track)\n');
                            }
                            term.resume();
                        });
                    } else {
                        var label = {
                            'deleted':  'deleted:    ',
                            'added':    'new file:   ',
                            'modified': 'modified:   ',
                            'absent':   'deleted:    '
                        };
                        var padding = '        ';
                        var output = [`On branch ${branch}`];
                        function listFiles(files, colorname) {
                            return files.map(([name, status]) => {
                                return padding + color(colorname, label[status.replace(/^\*/, '')] + name);
                            });
                        }
                        var lines;
                        var to_be_added = filter(changes, ['added', 'modified', 'deleted']);
                        if (to_be_added.length) {
                            lines = [
                                'Changes to be committed:',
                                '  (use "git rm --cached <file>..." to unstage)',
                                ''
                            ];
                            lines = lines.concat(listFiles(to_be_added, 'green'));
                            output.push(lines.join('\n'));
                        }
                        var not_added = filter(changes, ['*modified', '*deleted', '*absent']);
                        if (not_added.length) {
                            lines = [
                                'Changes not staged for commit:',
                                '  (use "git add <file>..." to update what will be committed)',
                                '  (use "git checkout -- <file>..." to discard changes in the working directory)',
                                ''
                            ];
                            lines = lines.concat(listFiles(not_added, 'red'));
                            output.push(lines.join('\n'));
                        }
                        var untracked = filter(changes, '*added');
                        if (untracked.length) {
                            lines = [
                                'Untracked files:',
                                '  (use "git add <file>..." to include in what will be committed)',
                                ''
                            ];
                            lines = lines.concat(untracked.map(([name, status]) => padding + color('red', name)));
                            output.push(lines.join('\n'));
                        }
                        if (output.length) {
                            term.echo(output.join('\n\n') + '\n');
                        }
                        term.resume();
                    }
                }).catch(error);
            },
            diff: function(cmd) {
                cmd.args.shift();
                term.pause();
                function diff({dir, filepath}) {
                    return gitDiff({dir, filepath, branch}).then(diff => {
                        const text = diff.hunks.map(hunk => {
                            let output = [];
                            output.push(color(
                                'persian-green',
                                [
                                    '@@ -',
                                    hunk.oldStart,
                                    ',',
                                    hunk.oldLines,
                                    ' +',
                                    hunk.newStart,
                                    ',',
                                    hunk.newLines,
                                    ' @@'
                                ].join('')
                            ));
                            output = output.concat(hunk.lines.map(line => {
                                let color_name;
                                if (line[0].match(/[+-]/)) {
                                    color_name = line[0] == '-' ? 'red' : 'green';
                                }
                                if (color_name) {
                                    return color(color_name, line);
                                } else {
                                    return line;
                                }
                            }));
                            return output.join('\n');
                        }).join('\n');
                        return {
                            text,
                            filepath
                        };
                    });
                }
                function format(diff) {
                    const header = ['diff --git a/' + diff.filepath + ' b/' + diff.filepath];
                    header.push('--- ' + diff.filepath);
                    header.push('+++ ' + diff.filepath);
                    return [color('white', header.join('\n')), diff.text].join('\n');
                }
                gitroot(cwd).then(dir => {
                    if (!cmd.args.length) {
                        return git.listFiles({dir,fs}).then(files => {
                            return Promise.all(files.map((filepath) => {
                                return git.status({fs, dir, filepath}).then(status => {
                                    if (['unmodified', 'ignored'].includes(status)) {
                                        return null;
                                    } else {
                                        return diff({dir, filepath});
                                    }
                                });
                            }));
                        }).then((diffs) => {
                            return diffs.filter(Boolean).reduce((acc, diff) => {
                                acc.push(format(diff));
                                return acc;
                            }, []).join('\n');
                        });
                    } else {
                        var re = new RegExp('^' + dir + '/?');
                        var filepath = fname.replace(re, '');
                        return diff({dir, filepath}).then(({diff}) => diff).then(format);
                    }
                }).then(text => {
                    if (text.length - 1 > term.rows()) {
                        term.less(text);
                    } else {
                        term.echo(text);
                    }
                    term.resume();
                }).catch(err => term.error(err.message).resume());
            },
            log: function(cmd) {
                term.pause();
                var depth = getOption('-n', cmd.args);
                depth = depth ? +depth : undefined;
                gitroot(cwd).then(dir => {
                    return Promise.all([getHEAD({dir}), getHEAD({dir, remote: true})])
                                  .then(([head, remote_head]) => ({ dir, head, remote_head }));
                }).then(({dir, head, remote_head}) => {
                    function format(commit) {
                        console.log({head, remote_head, commit: commit.oid});
                        var output = [];
                        var suffix = '';
                        if (head === remote_head && head === commit.oid) {
                            suffix = [
                                ' (' + color('persian-green', 'HEAD -> '),
                                color('green', branch) + ',',
                                color('red', 'origin/' + branch) + ')'
                            ].join(' ');
                        } else if (remote_head === commit.oid) {
                            suffix = [
                                ' (' + color('red', `origin/${branch}`) + ',',
                                color('red', 'origin/HEAD') + ')'
                            ].join(' ');
                        } else if (head === commit.oid) {
                            suffix = [
                                ' (' + color('persian-green', 'HEAD -> '),
                                color('green', branch) + ')'
                            ].join(' ');
                        }
                        output.push(color('yellow', `commit ${commit.oid}` + suffix));
                        var committer = commit.committer;
                        if (committer) {
                            output.push(`Author: ${committer.name} <${committer.email}>`);
                            output.push(`Date: ${date(committer.timestamp, committer.timezoneOffset)}`);
                        }
                        output.push('');
                        output.push(`    ${commit.message}`);
                        return output.join('\n');
                    }
                    return git.log({fs, dir, depth, ref: branch}).then(commits => {
                        var text = commits.filter(commit => !commit.error).map(format).join('\n\n');
                        if (text.length - 1 > term.rows()) {
                            term.less(text);
                        } else {
                            term.echo(text);
                        }
                        term.resume();
                    });
                }).catch(error);
            },
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
        },
        credits: function() {
          var lines = [
              '',
              'Projects used with GIT Web Terminal:',
              '\t[[!;;;;https://isomorphic-git.github.io]isomorphic-git] v. ' + git.version() + ' by William Hilton',
              '\t[[!;;;;https://github.com/jvilk/BrowserFS]BrowserFS] by John Vilk',
              '\t[[!;;;;https://terminal.jcubic.pl]jQuery Terminal] v.' + $.terminal.version + ' by Jakub Jankiewicz',
              '\t[[!;;;;https://github.com/timoxley/wcwidth]wcwidth] by Tim Oxley',
              '\t[[!;;;;https://github.com/inexorabletash/polyfill]keyboard key polyfill] by Joshua Bell',
              '\t[[!;;;;https://github.com/jcubic/jsvi]jsvi] originaly by Internet Connection, Inc. with changes from Jakub Jankiewicz',
              '\t[[!;;;;https://github.com/Olical/EventEmitter/]EventEmitter] by Oliver Caldwell',
              '\t[[!;;;;https://github.com/PrismJS/prism]PrismJS] by Lea Verou',
              '\t[[!;;;;https://github.com/kpdecker/jsdiff]jsdiff] by Kevin Decker',
              '\t[[!;;;;https://github.com/softius/php-cross-domain-proxy]AJAX Cross Domain (PHP) Proxy] by Iacovos Constantinou',
              '\t[[!;;;;https://github.com/jcubic/Clarity]Clarity icons] by Jakub Jankiewicz',
              '\t[[!;;;;https://github.com/jcubic/jquery.splitter]jQuery Splitter] by Jakub Jankiewicz',
              '\t[[!;;;;http://www.ymacs.org/]Ymacs] by Mihai Bazon & Dynarch.com',
              '\t[[!;;;;http://stuk.github.io/jszip/]JSZip] by Stuart Knightley',
              '',
              'Contributors:'
          ].concat(contributors.map(user => '\t[[!;;;;' + user.url + ']' + (user.fullname || user.name) + ']'));
          term.echo(lines.join('\n') + '\n');
        },
        help: function() {
            term.echo('\nList of commands: ' + Object.keys(commands).join(', '));
            term.echo('List of Git commands: ' + Object.keys(commands.git).join(', '));
            term.echo([
                '',
                'to use git you first need to clone the repo; it may take a while (depending on the size),',
                'then you can made changes using [[;#fff;]vi], use [[;#fff;]git add] and then [[;#fff;]git commit].',
                'Before you commit you need to use the command [[b;#fff;]git login] which will ask for credentials.',
                'It will also ask for full name and email to be used in [[b;#fff;]git commit]. If you set the correct',
                'username and password you can push to remote; if you type the wrong credentials you can call login again',
                ''
            ].join('\n'));
        }
    };
    var scrollTop;
    var term = $('#terminal').terminal(function(command, term) {
      var cmd = $.terminal.split_command(command);
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
      } else if (command) {
          term.error('Unknown command');
      }
    }, {
        execHash: true,
        // fix wierd jumping on windows/chrome
        keydown: function() {
            scrollTop = term.scrollTop();
            // term.prop({scrollTop: self.prop('scrollHeight')});
        },
        keyup: function() {
            if (typeof scrollTop !== 'undefined') {
                setTimeout(() => term.scrollTop(scrollTop), 0);
            }
        },
        completion: function(string, cb) {
            var cmd = $.terminal.parse_command(this.before_cursor());
            function processAssets(callback) {
                var dir = get_path(string);
                list('/' + dir.join('/')).then(callback);
            }
            function prepend(list) {
                if (string.match(/\//)) {
                    var path = string.replace(/\/[^\/]+$/, '').replace(/\/+$/, '');
                    return list.map((dir) => path + '/' + dir);
                } else {
                    return list;
                }
            }
            function trailing(list) {
                return list.map((dir) => dir + '/');
            }
            if (cmd.name !== string) {
                switch (cmd.name) {
                    // complete file and directories
                    case 'rm':
                    case 'cat':
                    case 'vi':
                    case 'less':
                    case 'emacs':
                        return processAssets(content => cb(prepend(trailing(content.dirs).concat(content.files))));
                    // complete directories
                    case 'ls':
                    case 'cd':
                        return processAssets(content => cb(prepend(trailing(content.dirs))));
                }
            }
            if (cmd.args.length) {
                var command = commands[cmd.name];
                if (command) {
                    var args = cmd.args.slice();
                    while (true) {
                        if (typeof command == 'object' && args.length > 1) {
                            command = command[args.shift()];
                        } else {
                            break;
                        }
                    }
                    if ($.isPlainObject(command)) {
                        cb(Object.keys(command));
                    }
                }
            } else {
                cb(Object.keys(commands));
            }
        },
        greetings: false,
        name,
        prompt: function(cb) {
            var path = color('blue', cwd);
            var b = branch ? ' &#91;' + color('violet', branch) + '&#93;' : '';
            cb([
                color('green', ('me@hunterpollpeter')),
                ':',
                path,
                b,
                '$ '
            ].join(''));
        }
    }).echo(greetings);
});
// ---------------------------------------------------------------------------------------------------------
// prism overwrite to produce terminal formatting instead of html
(function(Token) {
    var _ = Prism;
    _.Token = function(type, content, alias, matchedStr, greedy) {
        Token.apply(this, [].slice.call(arguments));
    };
    _.Token.stringify = function(o, language, parent) {
        if (typeof o == 'string') {
            return o;
        }

        if (_.util.type(o) === 'Array') {
            return o.map(function(element) {
                return _.Token.stringify(element, language, o);
            }).join('');
        }

        var env = {
            type: o.type,
            content: _.Token.stringify(o.content, language, parent),
            tag: 'span',
            classes: ['token', o.type],
            attributes: {},
            language: language,
            parent: parent
        };

        if (env.type == 'comment') {
            env.attributes['spellcheck'] = 'true';
        }

        if (o.alias) {
            var aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
            Array.prototype.push.apply(env.classes, aliases);
        }

        _.hooks.run('wrap', env);

        var attributes = Object.keys(env.attributes).map(function(name) {
            return name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
        }).join(' ');

        return env.content.split(/\n/).map(function(content) {
            return '[[b;;;' + env.classes.join(' ') + ']' + content + ']';
        }).join('\n');

    };
})(Prism.Token);

// ---------------------------------------------------------------------------------------------------------
function time() {
    var d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => ('0' + n).slice(-2)).join(':');
}

// ---------------------------------------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------------------------------------
// source: https://stackoverflow.com/a/3629861/387194
function union(x, y) {
  var obj = {};
  for (var i = x.length-1; i >= 0; -- i)
     obj[x[i]] = x[i];
  for (var i = y.length-1; i >= 0; -- i)
     obj[y[i]] = y[i];
  var res = []
  for (var k in obj) {
    if (obj.hasOwnProperty(k))  // <-- optional
      res.push(obj[k]);
  }
  return res;
}

// ---------------------------------------------------------------------------------------------------------
function intersection(a, b) {
    return a.filter(function(n) {
        return b.includes(n);
    });
}

// ---------------------------------------------------------------------------------------------------------
async function rmdir(dir) {
    return new Promise(function(resolve, reject) {
        fs.readdir(dir, async function(err, list) {
            if (err) {
                return reject(err);
            }
            for(var i = 0; i < list.length; i++) {
                var filename = path.join(dir, list[i]);
                var stat = await new Promise(function(resolve, reject) {
                    fs.stat(filename, function(err, stat) {
                        if (err) {
                            return reject(err);
                        }
                        resolve(stat);
                    });
                });
                if (!filename.match(/^\.{1,2}$/)) {
                    if(stat.isDirectory()) {
                        await rmdir(filename);
                    } else {
                        await new Promise(function(resolve, reject) {
                            fs.unlink(filename, function(err) {
                                if (err) {
                                    return reject(err);
                                }
                                resolve();
                            });
                        });
                    }
                }
            }
            fs.rmdir(dir, resolve);
        });
    });
}



// ---------------------------------------------------------------------------------------------------------
async function listBranchFiles({fs, dir, branch}) {
    const repo = { fs, dir };
    const sha = await git.resolveRef({ ...repo, ref: `refs/remotes/origin/${branch}` });
    const { object: { tree } } = await git.readObject({ ...repo, oid: sha });
    var list = [];
    return traverseCommit({fs, dir, sha, callback: ({filepath}) => list.push(filepath)}).then(() => list);
}
// ---------------------------------------------------------------------------------------------------------
async function traverseCommit({fs, dir, sha, callback = $.noop}) {
    const repo = {fs, dir};
    const { object: { tree } } = await git.readObject({ ...repo, oid: sha });
    return await (async function readFiles(oid, path) {
        const { object: { entries } } = await git.readObject({ ...repo, oid});
        var i = 0;
        return (async function loop() {
            var entry = entries[i++];
            if (entry) {
                if (entry.type == 'blob') {
                    var filepath = path.concat(entry.path).join('/');
                    await callback({entry, filepath, oid: entry.oid});
                } else if (entry.type == 'tree' && entry.path !== '.git') {
                    await readFiles(entry.oid, path.concat(entry.path));
                }
                return loop();
            }
        })();
    })(tree, []);
}

// ---------------------------------------------------------------------------------------------------------
async function gitCommitDiff({fs, dir, newSha, oldSha}) {
    var result = {};
    function reader(name) {
        return async ({filepath, oid}) => {
            try {
                const { object: pkg } = await git.readObject({ fs, dir, oid });
                result[filepath] = result[filepath] || {};
                result[filepath][name] = pkg.toString('utf8');
            } catch(e) {
                // ignore missing file/object
            }
        };
    }
    await traverseCommit({fs, dir, sha: oldSha, callback: reader('oldFile')});
    await traverseCommit({fs, dir, sha: newSha, callback: reader('newFile')});
    Object.keys(result).forEach(key => {
        var diff = JsDiff.structuredPatch(key, key, result[key].oldFile || '', result[key].newFile || '');
        if (typeof result[key].oldFile === 'undefined') {
            result[key].added = true;
        } else if (typeof result[key].newFile === 'undefined') {
            result[key].deleted = true;
        } else if (!diff.hunks.length) {
            delete result[key];
        }
        if (diff.hunks.length) {
            result[key].diff = diff;
        }
    });
    return result;
}

// ---------------------------------------------------------------------------------------------------------
function diffStat(diffs) {
    var modifications = diffs.reduce((acc, {hunks}) => {
        hunks.forEach(function(hunk) {
            hunk.lines.forEach((line) => {
                if (line[0] === '-') {
                    acc.minus++;
                } else if (line[0] === '+') {
                    acc.plus++;
                }
            });
        });
        return acc;
    }, {plus: 0, minus: 0});
    const plural = n => n == 1 ? '' : 's';
    var stat = [' ' + diffs.length + ' file' + plural(diffs.length)];
    if (modifications.plus) {
        stat.push(`${modifications.plus} insertion${plural(modifications.plus)}(+)`);
    }
    if (modifications.minus) {
        stat.push(`${modifications.minus} insertion${plural(modifications.minus)}(-)`);
    }
    return stat.join(', ');
}

// ---------------------------------------------------------------------------------------------------------
async function readBranchFile({ dir, fs, filepath, branch }) {
    const ref = 'refs/remotes/origin/' + branch;
    const sha = await git.resolveRef({ fs, dir,  ref });
    const { object: { tree } } = await git.readObject({ fs, dir, oid: sha });
    return (async function loop(tree, path) {
        if (!path.length) {
            throw new Error(`File ${filepath} not found`);
        }
        var name = path.shift();
        const { object: { entries } } = await git.readObject({ fs, dir, oid: tree });
        const packageEntry = entries.find((entry) => entry.path === name);
        if (!packageEntry) {
            throw new Error(`File ${filepath} not found`);
        } else {
            if (packageEntry.type == 'blob') {
                const { object: pkg } = await git.readObject({ fs, dir, oid: packageEntry.oid })
                return pkg.toString('utf8');
            } else if (packageEntry.type == 'tree') {
                return loop(packageEntry.oid, path);
            }
        }
    })(tree, filepath.split('/'));
}
const padleft = (input, n, str) => (new Array(n + 1).join(str || ' ') + input).slice(-n);
const padright = (input, n, str) => (input + new Array(n + 1).join(str || ' ')).substring(0, n);
// ---------------------------------------------------------------------------------------------------------
function date(timestamp, timezoneOffset) {
    timezoneOffset *= -1;
    var d = new Date(timestamp * 1000);
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var months = [
        'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December'
    ];
    var day = days[d.getDay()].substring(0, 3);
    var month = months[d.getMonth()].substring(0, 3);
    const pad = (input) => padleft(input, 2, '0');
    function offset(offset) {
        var timezone = ('0' + (offset / 60).toString().replace('.', '') + '00').slice(-4);
        return (offset > 1 ? '+' : '-') + timezone;
    }
    return [day, month, pad(d.getDate()),
            [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(':'),
            d.getFullYear(),
            offset(timezoneOffset)
    ].join(' ');
}

// ---------------------------------------------------------------------------------------------------------
function gitroot(cwd) {
    return git.findRoot({fs, filepath: cwd});
}
// ---------------------------------------------------------------------------------------------------------
async function gitBranch({fs, cwd}) {
    try {
        var dir = await gitroot(cwd);
        return git.currentBranch({fs, dir});
    } catch(e) {
    }
}
// ---------------------------------------------------------------------------------------------------------
function gitDiff({dir, filepath, branch}) {
    var fname = dir + '/' + filepath;
    return new Promise(function(resolve, reject) {
        fs.readFile(fname, async function(err, newFile) {
            if (!err) {
                newFile = newFile.toString();
            }
            readBranchFile({fs, dir, branch, filepath}).then(oldFile => {
                const diff = JsDiff.structuredPatch(filepath, filepath, oldFile || '', newFile || '');
                resolve(diff);
            }).catch(err => reject(err));
        });
    });
}
// ---------------------------------------------------------------------------------------------------------
async function gitReset({fs, dir, ref, branch, hard = false}) {
    var re = /^HEAD~([0-9]+)$/
    var m = ref.match(re);
    if (m) {
        var count = +m[1];
        var commits = await git.log({fs, dir, depth: count + 1});
        return new Promise((resolve, reject) => {
            if (commits.length < count + 1) {
                return reject('Not enough commits');
            }
            var commit = commits.pop().oid;
            fs.writeFile(`${dir}/.git/refs/heads/${branch}`, commit + '\n', (err) => {
                if (err) {
                    return reject(err);
                }
                if (!hard) {
                    resolve();
                } else {
                    // clear the index (if any)
                    fs.unlink(`${dir}/.git/index`, (err) => {
                        if (err) {
                            return reject(err);
                        }
                        // checkout the branch into the working tree
                        git.checkout({ dir, fs, ref: branch }).then(resolve);
                    });
                }
            });
        });
    }
    return Promise.reject(`Wrong ref ${ref}`);
}
// ---------------------------------------------------------------------------------------------------------
function gitURL({fs, dir, gitdir = path.join(dir, '.git'), remote = 'origin'}) {
    return git.config({fs, gitdir, path: `remote.${remote}.url`});
}
// ---------------------------------------------------------------------------------------------------------
async function repoURL({fs, dir, gitdir = path.join(dir, '.git'), remote = 'origin'}) {
    var url = await gitURL({fs, dir, gitdir, remote});
    return url.replace(/^https:\/\/jcubic.pl\/proxy.php\?/, '');
}
// ---------------------------------------------------------------------------------------------------------
function getHEAD({dir, gitdir, remote = false}) {
    if (!remote) {
        return git.resolveRef({fs, dir, ref: 'HEAD'});
    } else {
        //return git.resolveRef({fs, dir: 'test', ref: 'refs/remotes/origin/HEAD'});
    }
    return new Promise((resolve, reject) => {
        var base = `${dir}/${gitdir || '.git'}/`;
        var ref_file = remote ? `${base}refs/remotes/origin/HEAD` : `${base}HEAD`;
        fs.readFile(ref_file, function(err, data) {
            var ref;
            if (err) {
                //return reject(`can't read ${ref_file}: ${err}` );
                ref = 'refs/remotes/origin/master';
            } else {
                ref = data.toString().match(/ref: (.*)/)[1];
            }
            fs.readFile(base + ref, function(err, data) {
                if (err) {
                    return reject(`can't read ${base + ref}: ${err}`);
                }
                resolve(data.toString().trim());
            });
        });
    });
}
// ---------------------------------------------------------------------------------------------------------
function mkdir(dir, parent = false) {
    return new Promise(function(resolve, reject) {
        if (parent) {
            dir = dir.split('/');
            if (!dir.length) {
                return reject('Invalid argument');
            }
            var full_path = '/';
            (function loop() {
                if (!dir.length) {
                    return resolve();
                }
                full_path = path.join(full_path, dir.shift());
                fs.stat(full_path, function(err, stat) {
                    if (err) {
                        fs.mkdir(full_path, function(err) {
                            if (err) {
                                reject(err);
                            } else {
                                loop();
                            }
                        });
                    } else if (stat) {
                        if (stat.isDirectory()) {
                            loop();
                        } else if (stat.isFile()) {
                            reject(`${full_path} is a file`);
                        }
                    }
                });
            })();
        } else {
            fs.stat(dir, function(err, stat) {
                if (err) {
                    fs.mkdir(dir, function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                } else if (stat) {
                    if (stat.isDirectory()) {
                        reject('Directory already exists');
                    } else if (stat.isFile()) {
                        reject(`${dir} is a File`);
                    }
                }
            });
        }
    });
}
