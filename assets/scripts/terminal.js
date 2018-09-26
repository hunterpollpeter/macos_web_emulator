function initialize_terminal() {
  $('#terminal').terminal(function(command) {
      if (command !== 'test') {
          try {
              var result = window.eval(command);
              if (result !== undefined) {
                  this.echo(new String(result));
              }
          } catch(e) {
              this.error(new String(e));
          }
      } else {
         this.echo('sdfadsfsdsadfsd');
      }
  }, {
      greetings: 'Hunter Pollpeter',
      name: 'terminal',
      prompt: '$ '
  });
}
