// Random Package

// Database
Steps = new Mongo.Collection("steps");
Messages = new Mongo.Collection("messages");

// Router
Router.route('/', function () {
    // Create a new url_id
    this.render('home');
});

Router.route('/b/:_id', function () {
    Session.set('url_id', this.params._id);
    this.render('board');
});


// Client Side
if (Meteor.isClient) {

    // Board variables
    var stepsize;
    var x0;
    var y0;
    var canvas;
    var ctx;
    var board_id;


    /////// Functions for drawing board ////////

    // Draw Board
    var draw_board = function () {
        // Backgroud
        ctx.fillStyle = "#CC9900";
        ctx.fillRect(x0-stepsize/2, y0-stepsize/2, stepsize*19, stepsize*19);

        // Draw Lines
        for (var i = 0; i<19; i++) {
            // vertical lines
            ctx.beginPath();
            ctx.moveTo(x0+i*stepsize, y0);
            ctx.lineTo(x0+i*stepsize, y0+18*stepsize);
            ctx.stroke();
            // horizontal lines
            ctx.beginPath();
            ctx.moveTo(x0, y0+i*stepsize);
            ctx.lineTo(x0+18*stepsize, y0+i*stepsize);
            ctx.stroke();
        }

        // Draw the 9 dots
        for (var i = 0; i < 3; i++) {
            for (var j = 0; j < 3; j++) {
                ctx.beginPath();
                ctx.arc(x0+3*stepsize+6*i*stepsize, y0+3*stepsize+6*j*stepsize, 2, 0, 2 * Math.PI, false);
                ctx.fillStyle = 'black';
                ctx.fill();
            }
        }

        // Draw Labels
        var ax0 = x0 - 0.3*stepsize;
        var ay0 = y0 - 0.6*stepsize;
        var ay_shift = 20*stepsize;
        var nx0 = x0 - 1.8*stepsize;
        var ny0 = y0 + 0.4*stepsize;
        var nx_shift = 20.3*stepsize;
        ctx.font = stepsize+'px monospace';
        for (var i = 0; i<19; i++) {
            // Alpha
            ctx.fillText('ABCDEFGHJKLMNOPQRST'[i], ax0+i*stepsize, ay0);
            ctx.fillText('ABCDEFGHJKLMNOPQRST'[i], ax0+i*stepsize, ay0+ay_shift);
            // Num
            ctx.fillText( (i+1).toString(), nx0, ny0+i*stepsize);
            ctx.fillText( (i+1).toString(), nx0+nx_shift, ny0+i*stepsize);
        }
    };

    // Clear Board
    var clear_board = function () {
        ctx.clearRect(0,0,canvas.width, canvas.height);
    };

    // Draw Stones
    var draw_stone = function (step) {
        ctx.beginPath();
        ctx.arc(x0+'ABCDEFGHJKLMNOPQRST'.indexOf(step.alpha)*stepsize, y0+(19-step.num)*stepsize, stepsize/2, 0, 2 * Math.PI, false);
        if (step.color === 'B') {
            ctx.fillStyle = 'black';
        } else {
            ctx.fillStyle = 'white';
        }
        ctx.fill();
    };


    // Render boardcanvas //
    Template.boardcanvas.onRendered(function () {
        // get board
        board_id = Session.get('url_id');

        // Canvas
        canvas = document.getElementById('goboard');
        ctx = canvas.getContext("2d");
        stepsize = 25;
        x0 = canvas.width/2 - 9*stepsize;
        y0 = canvas.width/2 - 9*stepsize;

        // Draw Board
        draw_board();

        // Load stones
        var s = Steps.find({board_id: board_id});
        s.forEach( draw_stone );

        // Observe Database changes
        Steps.find({board_id: board_id}).observeChanges({
            added: function (id, fields) {
                draw_stone(fields);
            },
            removed: function (id) {
                clear_board();
                draw_board();
                Steps.find({board_id: board_id}).forEach(draw_stone);
            },
        });

    });


    // Register click events
    Template.boardcanvas.events({
        'mousedown #goboard': function (event) {
            var color;
            if (event.button === 2) {
                color = 'W';
            } else {
                color = 'B';
            }
            var alpha = 'ABCDEFGHJKLMNOPQRST'[Math.round((event.offsetX-x0)/stepsize)];
            var num = 19-Math.round((event.offsetY-y0)/stepsize);
            Meteor.call('insert_step', color+alpha+num.toString(), board_id);
        },
        // Disables the menu
        'contextmenu #goboard': function (event) {
            return false;
        },
    });

    Template.boardfunctions.events({
        'click .clear': function(event) {
            Meteor.call('clear_board', board_id);
        },
    });

    // New board
    Template.home.events({
        'submit .newboard': function (event) {
            event.preventDefault();
            var boardname = event.target.boardname.value;
            if (boardname) {
                Router.go('/b/'+encodeURIComponent(boardname).replace(/%20/g, '-'));
            }
        },
    });

    // Load the list of boards
    Template.home.helpers({
        boards: function () {
            var steps = Steps.find({}, {fields: {board_id: true}}).fetch();
            var tmp = {};
            steps.forEach(function (s) {
                if (s.board_id) tmp[s.board_id]=0;
            });
            return Object.keys(tmp).map(function (k) {
                return {board_id: k};
            });
        },
    });


    // Chatroom //

    Template.chatroom.onCreated(function () {
        board_id = Session.get('url_id');
    });

    Template.chatroom.events({
        'submit .chatform': function (event) {
            event.preventDefault();
            var username = event.target.username.value;
            var message = event.target.message.value;
            if (username !== '' && message !== '') {
                Meteor.call('insert_message', board_id, username, message);
                event.target.message.value = '';
            }
        },
    });

    Template.chatroom.helpers({
        messages: function () {
            return Messages.find({board_id: board_id}, {sort: {created_at: -1}});
        },
    });
   

}

// Server
if (Meteor.isServer) {
    Meteor.startup(function () {
        // code to run on server at startup
        Meteor.methods({
            // For inserting steps
            insert_step: function (step, board_id) {
                // parse text into color, alphabet, number
                var color = step.charAt(0).toUpperCase();
                var alpha = step.charAt(1).toUpperCase();
                var num = Number(step.substring(2));

                var error = false;
                if (color !== 'B' && color !== 'W') { error = true; }
                if ('ABCDEFGHJKLMNOPQRST'.indexOf(alpha) === -1) { error = true; }
                if (isNaN(num) || num < 1 || num > 19) { error = true; }
                if (error) {
                    console.log('Recieved Error Input: ' + step);
                    return;
                }

                var s = Steps.findOne({
                    board_id : board_id,
                    alpha    : alpha,
                    num      : num,
                });
                // Remove is exist
                if (s) {
                    Steps.remove(s);
                } else {
                    Steps.insert({
                        board_id : board_id,
                        color    : color,
                        alpha    : alpha,
                        num      : num,
                    });
                }

            },

            // Fast clearing the board
            clear_board: function (board_id) {
                Steps.remove({board_id: board_id});
            },

            insert_message: function (board_id, username, message) {
                Messages.insert({
                    board_id : board_id,
                    username: username,
                    message: message,
                    created_at: new Date(),
                });
            },
        });
    });
}
