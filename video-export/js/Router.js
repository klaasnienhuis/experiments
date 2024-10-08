(function(window) {
    'use strict';

    var Router = window['Backbone'].Router.extend({
        routes: {
            '': 'index',
            'model/:urlid': 'screenshot'
        },

        initialize: function(options) {
            this.appView = options.appView;
        },

        index: function() {},

        screenshot: function(urlid) {
            var uidRegex = /^[0-9a-zA-Z]{27,32}$/;

            if (!urlid.match(uidRegex)) {
                window.console.log('Invalid model UID in URL hash:', urlid);
                return;
            }

            window.console.log('Loading model UID:', urlid);

            this.appView.initViewer(urlid, false);
        }
    });

    window['Router'] = Router;
})(window);
