/*jslint white: true */
/*global d3 */

"use strict";

function renderTreeView(root, level) {
    var m, w, h, i, tree, diagonal, vis;

    function toggle(d) {
        if (d.children) {
            d.hChildren = d.children;
            d.children = null;
        } else {
            d.children = d.hChildren;
            d.hChildren = null;
        }
    }

    function update(source) {
        var duration, nodes, node, nodeEnter, nodeUpdate, nodeExit, link;
        duration = (d3.event && d3.event.altKey ? 1500 : 150);
        nodes = tree.nodes(root).reverse();
        nodes.forEach(function(d) {
            d.y = d.depth * 180;
        });
        node = vis.selectAll("g.node")
            .data(nodes, function(d) {
                if (!d.id) {
                    i = i + 1;
                    d.id = i;
                }
                return d.id;
            });
        nodeEnter = node.enter().append("svg:g")
            .attr("class", "node")
            .attr("transform", function() {
                return "translate(" + source.y0 + "," + source.x0 + ")";
            })
            .on("click", function(d) {
                toggle(d);
                update(d);
            });
        nodeEnter.append("svg:circle")
            .attr("r", 1e-6)
            .style("fill", function(d) {
                return d.hChildren ? "lightsteelblue" : "#fff";
            });
        nodeEnter.append("svg:text")
            .attr("x", function(d) {
                return d.children || d.hChildren ? -10 : 10;
            })
            .attr("dy", ".35em")
            .attr("text-anchor", function(d) {
                return d.children || d.hChildren ? "end" : "start";
            })
            .text(function(d) {
                return d.name;
            })
            .style("fill-opacity", 1e-6);
        nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function(d) {
                return "translate(" + d.y + "," + d.x + ")";
            });
        nodeUpdate.select("circle")
            .attr("r", 4.5)
            .style("fill", function(d) {
                return d.hChildren ? "lightsteelblue" : "#fff";
            });
        nodeUpdate.select("text")
            .style("fill-opacity", 1);
        nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function() {
                return "translate(" + source.y + "," + source.x + ")";
            })
            .remove();
        nodeExit.select("circle")
            .attr("r", 1e-6);
        nodeExit.select("text")
            .style("fill-opacity", 1e-6);
        link = vis.selectAll("path.link")
            .data(tree.links(nodes), function(d) {
                return d.target.id;
            });
        link.enter().insert("svg:path", "g")
            .attr("class", "link")
            .attr("d", function() {
                var o = {
                    x: source.x0,
                    y: source.y0
                };
                return diagonal({
                    source: o,
                    target: o
                });
            })
            .transition()
            .duration(duration)
            .attr("d", diagonal);
        link.transition()
            .duration(duration)
            .attr("d", diagonal);
        link.exit().transition()
            .duration(duration)
            .attr("d", function() {
                var o = {
                    x: source.x,
                    y: source.y
                };
                return diagonal({
                    source: o,
                    target: o
                });
            })
            .remove();
        nodes.forEach(function(d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    function closeAll(d) {
        if (d.children) {
            d.children.forEach(closeAll);
            toggle(d);
        }
    }

    function toggleUntil(d, level) {
        if (level) {
            toggle(d);
            if (d.children) {
                d.children.forEach(function(ele) {
                    toggleUntil(ele, level - 1);
                });
            }
        }
    }

    m = [20, 120, 20, 120];
    w = 1280 - m[1] - m[3];
    h = 800 - m[0] - m[2];
    i = 0;
    tree = d3.layout.tree()
        .size([h, w]);
    diagonal = d3.svg.diagonal()
        .projection(function(d) {
            return [d.y, d.x];
        });
    d3.select("#treeView").html("");
    vis = d3.select("#treeView").append("svg:svg")
        .attr("width", w + m[1] + m[3])
        .attr("height", h + m[0] + m[2])
        .append("svg:g")
        .attr("transform", "translate(" + m[3] + "," + m[0] + ")");
    root.x0 = h / 2;
    root.y0 = 0;
    closeAll(root);
    toggleUntil(root, level);
    update(root);
}