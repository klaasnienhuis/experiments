'use strict';

var AppView = Backbone.View.extend({
    el: 'body',

    events: {
        'click li[data-id]': 'toggle',
        'click [name="load-model"]': 'loadModel',
        'change input[name="postprocessing"]': 'onPostProcessingChange'
    },

    initialize: function() {
        this._optionCollections = {};
        this._optionsViews = {};
        this._embedParams = {
            ui_infos: 0,
            ui_stop: 0,
            debug3d: 1
        };

        this.urlid = this.getParameterByName('urlid');
        if (!this.urlid) {
            return;
        }

        this.initViewer(
            function() {
                this.initOptions();
                this.initPostProcessing();
            }.bind(this)
        );

        this.hidden = [];
    },

    getParameterByName: function(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
            results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    },

    loadModel: function() {
        var picker = new SketchfabPicker();
        picker.pick({
            success: function(model) {
                console.log(model);
                var location = window.location;
                var url = location.protocol + '//' +location.host + location.pathname + '?urlid=' + model.uid
                window.location = url;
            }.bind(this)
        });
    },

    initViewer: function(callback) {
        var self = this;
        var iframe = this.$el.find('#api-frame').get(0);
        var version = '1.12.1';

        var client = new Sketchfab(version, iframe);

        client.init(
            this.urlid,
            _.extend(this._embedParams, {
                success: function onSuccess(api) {
                    self._api = api;
                    api.start(function() {
                        api.addEventListener('viewerready', function() {
                            callback();
                        });
                    });
                },
                error: function onError() {
                    console.log('Error while initializing the viewer');
                }
            })
        );
    },

    toggle: function(e) {
        e.stopPropagation();
        var $target = $(e.currentTarget);

        console.log(
            $target.attr('data-id'),
            $target
                .find('span')
                .first()
                .text()
        );

        var id = parseInt($target.attr('data-id'), 10);

        if (this.hidden[id]) {
            this._api.show(id);
            this.hidden[id] = false;
            console.log('Show', id);
            $target.removeClass('hidden');
        } else {
            this._api.hide(id);
            this.hidden[id] = true;
            $target.addClass('hidden');
            console.log('Hide', id);
        }
    },

    initOptions: function() {
        this._api.getSceneGraph(
            function(err, result) {
                if (err) {
                    console.log('Error getting nodes');
                    return;
                }

                console.log(result);

                function renderChildren(node) {
                    var nodes = [];
                    for (var i = 0, l = node.children.length; i < l; i++) {
                        nodes.push(renderNode(node.children[i]));
                    }
                    return '<ul>' + nodes.join('') + '</ul>';
                }

                function escapeHtml(html) {
                    return html
                         .replace(/&/g, "&amp;")
                         .replace(/</g, "&lt;")
                         .replace(/>/g, "&gt;")
                         .replace(/"/g, "&quot;")
                         .replace(/'/g, "&#039;");
                 }

                function renderNode(node) {
                    var icons = {
                        Group: 'ion-folder',
                        Geometry: 'ion-document',
                        MatrixTransform: 'ion-arrow-expand'
                    };

                    var out = '';

                    out += '<li data-type="' + node.type + '" data-id="' + node.instanceID + '">';

                    out +=
                        '<i class="icon ' + icons[node.type] + '" title="' + node.type + '"></i> ';

                    out += '<span>' + (node.name ? escapeHtml(node.name) : '(' + node.type + ')') + '</span>';

                    if (node.children && node.children.length) {
                        out += renderChildren(node);
                    }

                    out += '</li>';

                    return out;
                }

                var out = '<ul>' + renderNode(result) + '</ul>';
                $('.objects').html(out);
            }.bind(this)
        );
    },

    initPostProcessing: function() {
        var out = '<ul>';

        this._api.getPostProcessing(function(settings) {

            if (settings.enable) {
                $('input[name="postprocessing"]').prop('disabled', false);
            }

            out += [
                settings.sharpenEnable ? '<li>Sharpen</li>' : '',
                settings.chromaticAberrationEnable ? '<li>Chromatic Aberration</li>' : '',
                settings.vignetteEnable ? '<li>Vignette</li>' : '',
                settings.bloomEnable ? '<li>Bloom</li>' : '',
                settings.toneMappingEnable ? '<li>Tone Mapping</li>' : '',
                settings.colorBalanceEnable ? '<li>Color Balance</li>' : ''
            ].join('');
            out += '</ul>';

            $('.postprocessing-settings').html(out);
        });
    },

    onPostProcessingChange: function(e) {
        this._api.setPostProcessing({
            enable: $(e.target).is(':checked')
        });
    }
});
