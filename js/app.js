StorageSolver = function(React, ReactDOM, componentHandler, MathProgBuilder){
  
  var R = React.createElement;

  var globalID = 1;
  var dtID = 1;

  /* UTILS */

  function part(f, arg) {
    return function(extra) {
      return f(arg, extra);
    }
  }
  
  /* SOLVER */
  
  function solveMILP(probtext, cb) {
    var lp = glp_create_prob();
    
    try {
      var tran = glp_mpl_alloc_wksp();
      glp_mpl_read_model_from_string(tran, 'Storage Solver', probtext);

      glp_mpl_generate(tran, null, null, null);
      glp_mpl_build_prob(tran, lp);
            
      var smcp = new SMCP({presolve: GLP_ON, tm_lim: 500});
      var ret = glp_simplex(lp, smcp);
      if (ret !== 0) {
        throw new Error("glp_simplex: error "+ret);
      }
      
      ret = glp_intopt(lp);
      if (ret !== 0) {
        throw new Error("glp_intopt: error "+ret);
      }
      
      var objective = Math.round(glp_mip_obj_val(lp));
      
      var variables = {};
      for(var i = 1; i <= glp_get_num_cols(lp); i++){
        variables[glp_get_col_name(lp, i)] = Math.round(glp_mip_col_val(lp, i));
      }

      var constraints = {};
      for(var i = 1; i <= glp_get_num_rows(lp); i++){
        constraints[glp_get_row_name(lp, i)] = Math.round(glp_mip_row_val(lp, i));
      }

      var status = glp_mip_status(lp);

      cb(null, { status: status, objective: objective, variables: variables, constraints: constraints });
    } catch(err) {
      cb(err, null);
    } finally {
      lp = null;
    }
  }

  /* MODEL */

	function getDefaultModel() {
		return {
			diskTypes: [ DiskType.newEmpty() ],
			constraints: [ { left: [ { basevar: "tot", subvar: "capacity" } ], op: '>=', right: 100 } ],
			objective: { func: "minimize", vars: [ { basevar: "tot", subvar: "cost" } ] }
		};
  }

  /* GUI BRICKS */

  var IconButton = React.createClass({
      componentDidMount: function() {
        var self = this.refs.self;
        componentHandler.upgradeElement(self);
      },

      render: function() {
        return R('button',
                 { ref: "self",
                   className: "mdl-button mdl-js-button mdl-button--icon mdl-js-ripple-effect mdl-button--colored",
                   onClick: this.props.onClick
                 },
                 R('i', { className: "material-icons" }, this.props.type)
        );
      }
  });


  var TextInput = React.createClass({
      getInitialState: function() {
        return { id: globalID++ };
      },
      
      componentDidMount: function() {
        var self = this.refs.self;
        componentHandler.upgradeElement(self);
      },

      onChange: function() {
        return this.props.onChange(this.refs.text.value);
      },

      render: function() {
        return R('div', { ref: "self", className: "mdl-textfield mdl-js-textfield mdl-textfield--floating-label" },
                 R('input', { ref: "text", className: "mdl-textfield__input", min: this.props.min,
                              type: "number", id: "text-"+this.state.id, step: this.props.step || "any",
                              value: this.props.value, onChange: this.onChange }),
          R('label', { className: "mdl-textfield__label", for: "text-"+this.state.id }, this.props.label),
          R('span', { className: "mdl-textfield__error" }, "Invalid value" )
        );
      }
  });

  
  var Button = React.createClass({
      componentDidMount: function() {
        var self = this.refs.self;
        componentHandler.upgradeElement(self);
      },
      
      render: function() {
        var className = "mdl-button mdl-js-button mdl-js-ripple-effect";
        if (this.props.raised) {
          className += " mdl-button--raised";
        }
        if (this.props.colored) {
          className += " mdl-button--colored";
        }
        className += " "+(this.props.className || "");
        
        return R('button',
                 { ref: "self",
                   className: className,
                   onClick: this.props.onClick },
                 this.props.children);
      }
  });


  var Slider = React.createClass({
      componentDidMount: function() {
        var self = this.refs.self;
        componentHandler.upgradeElement(self);
      },

      onChange: function() {
        this.props.onChange(this.refs.self.value);
      },

      render: function() {
        return R('input',
                 { ref: 'self', type: "range",
                   className: "mdl-slider mdl-js-slider",
                   min: this.props.min, max: this.props.max, value: this.props.value, step: this.props.step,
                   onChange: this.onChange }
        );
      }
  });

	var Table = React.createClass({
      componentDidMount: function() {
        var self = this.refs.self;
        componentHandler.upgradeElement(self);
      },

			render: function() {
				var className = "mdl-data-table mdl-js-data-table mdl-shadow--2dp ";
				className += this.props.className || "";
				return R('table',
								 { ref: 'self', className: className },
								 this.props.children
				);
			}
	});

	var TH = React.createClass({
			render: function() {
				var className = "";
				if (this.props.nonNumeric) {
					className += " mdl-data-table__cell--non-numeric";
				}

				return R('th', { className: className }, this.props.children);
			}
	});

	var TD = React.createClass({
			render: function() {
				var className = "";
				if (this.props.nonNumeric) {
					className += " mdl-data-table__cell--non-numeric";
				}

				return R('td', { className: className }, this.props.children);
			}
	});
	
  
  var List = React.createClass({
      onAdd: function() {
        var item = this.props.itemClass.newEmpty(this.props.extra);
        item._key = globalID++;
        this.props.data.push(item);
        this.props.onChange(this.props.data);
      },

      onRemove: function(i) {
        this.props.data.splice(i, 1);
        this.props.onChange(this.props.data);
      },

      onChange: function(i, data) {
        this.props.data[i] = data;
        this.props.onChange(this.props.data);
      },
      
      render: function() {
        var self = this;
        
        var list = [];

        this.props.data.forEach(function(data, i) {
            list.push(R('div', { key: "row-"+data._key, className: self.props.childClassName || "" },
                         R(IconButton, { type: "remove",
                                         onClick: part(self.onRemove, i) }),
                         R(self.props.itemClass, { data: data, index: i+1, extra: self.props.extra, onChange: part(self.onChange, i) })
            ));
        });

        return R('div', { className: this.props.className || "" },
            list,
            R(IconButton, { type: "add",  onClick: this.onAdd })
        );
      }
  });

  var Combo = React.createClass({
      onChange: function() {
        this.props.onChange(this.refs.select.value);
      },
      
      render: function() {
        var self = this;
        var opts = [];
        
        this.props.options.forEach(function(opt) {
            opts.push(R('option', { key: "option-"+opt.value, value: opt.value }, opt.name));
        });

        return R('select', { ref: "select", onChange: this.onChange, defaultValue: this.props.value },
                 opts
        );
      }
  });

  var ToggleLabel = React.createClass({
      onClick: function() {
        var value = this.props.value === this.props.options[0].value ? this.props.options[1].value : this.props.options[0].value;
        this.props.onChange(value);
      },
      
      render: function() {
        var label = this.props.value === this.props.options[0].value ? this.props.options[0].label : this.props.options[1].label;
        return R(Button, { colored: true, onClick: this.onClick }, label);
      }
  });

  var HBlock = React.createClass({
      render: function() {
        var className = "ss-inline";
        if (!this.props.noMargin) {
          className += " ss-margin";
        }
        
        return R('div', { className: className+" "+(this.props.className || "") }, this.props.children);
      }
  });
  
  /* OPTIMIZATION UI */

  var SolvedValue = React.createClass({
      render: function() {
        if (this.props.value === undefined || this.props.value === null) {
          return null;
        }

        return R(HBlock, {},
                 R('span', { className: "ss-grey" }, this.props.label),
                 ' ',
                 R('span', { className: "ss-solvedvalue" }, this.props.value)
        );
      }
  });
  
  var DiskType = React.createClass({
      statics: {
        newEmpty: function() {
          return { varname: 'DT'+(dtID++), type: 'ssd', iops: 50000, cost: 1, size: 1000,
                   raidType: 'none', raidGroup: 1, raidGroup2: 1, readRatio: 50 };
        }
      },
      
      onChangeType: function(value) {
        var data = this.props.data;
        data.type = value;
        data.iops = { 'ssd': 50000, 'hdd15': 150, 'hdd10': 100, 'hdd72': 70 }[value];
        this.props.onChange(this.props.data);
      },

      onChangeSize: function(value) {
        this.props.data.size = value;
        this.props.onChange(this.props.data);
      },

      onChangeIOPS: function(value) {
        this.props.data.iops = value;
        this.props.onChange(this.props.data);
      },

      onChangeRaidType: function(value){
        this.props.data.raidType = value;
        this.props.data.raidGroup = { 'none': 1, 'raid5': 3, 'raid6': 4, 'raid10': 2 }[value];
        this.props.data.raidGroup2 = { 'none': 1, 'raid5': 1, 'raid6': 1, 'raid10': 2 }[value];
        this.props.onChange(this.props.data);
      },

      onChangeRaidGroup: function(value) {
        this.props.data.raidGroup = value;
        this.props.onChange(this.props.data);
      },
        
      onChangeRaidGroup2: function(value) {
        this.props.data.raidGroup2 = value;
        this.props.onChange(this.props.data);
      },

      onChangeCost: function(value) {
        this.props.data.cost = value;
        this.props.onChange(this.props.data);
      },

      onChangeReadRatio: function(value) {
        this.props.data.readRatio = value;
        this.props.onChange(this.props.data);
      },

      render: function() {
        var types = [
          { value: "ssd", name: "SSD" },
          { value: "hdd15", name: "HDD 15k" },
          { value: "hdd10", name: "HDD 10k" },
          { value: "hdd72", name: "HDD 7.2k" }
        ];

        var raids = [
          { value: "none", name: "No RAID" },
          { value: "raid5", name: "RAID 5" },
          { value: "raid6", name: "RAID 6" },
          { value: "raid10", name: "RAID 10" },
        ];

        var minraid = { "none": 1, "raid5": 3, "raid6": 4, "raid10": 1 }[this.props.data.raidType];

        return R(HBlock, {},
                 R(HBlock, { className: "ss-grey" }, this.props.data.varname),
                 R(HBlock, {},
                   R(Combo, { value: this.props.data.type, options: types,
                              onChange: this.onChangeType })
                 ),
                 R(HBlock, {},
                   R(TextInput, { label: "Size", value: this.props.data.size, onChange: this.onChangeSize })
                 ),
                 R(HBlock, {},
                   R(TextInput, { label: "Cost", value: this.props.data.cost, onChange: this.onChangeCost })
                 ),
                 R(HBlock, {},
                   R(Combo, { value: this.props.data.raidType, options: raids,
                              onChange: this.onChangeRaidType })
                 ),
                 this.props.data.raidType !== "none" ?
                 R(HBlock, {},
                   R(TextInput, { label: "Raid group", min: minraid, step: 1,
                                  value: this.props.data.raidGroup, onChange: this.onChangeRaidGroup })
                 ) : null,
								 this.props.data.raidType === "raid10" ?
								 R(HBlock, {},
                   R(TextInput, { label: "Raid group 2", min: 1, step: 1,
                                  value: this.props.data.raidGroup2, onChange: this.onChangeRaidGroup2 })
                 ) : null,
                 R(HBlock, {},
                   R(TextInput, { label: "IOPS", value: this.props.data.iops, onChange: this.onChangeIOPS })
                 ),
                 R(HBlock, { noMargin: true, className: "ss-antimargin" },
                   R(Slider, { min: 0, max: 100, step: 5, value: this.props.data.readRatio, onChange: this.onChangeReadRatio })
                 ),
                 R(HBlock, { className: "ss-slidetext" },
                   "Read "+this.props.data.readRatio+"%"
                 ),
                 R(SolvedValue, { value: this.props.data.solution, label: "N. Disks" })
        );
      }
  });

  var Variable = React.createClass({
      statics: {
        newEmpty: function(extra) {
          return { basevar: extra.variables[0].value, subvar: "capacity" };
        }
      },

      onChangeBase: function(data) {
        this.props.data.basevar = data;
        this.props.onChange(this.props.data);
      },

      onChangeSub: function(data) {
        this.props.data.subvar = data;
        this.props.onChange(this.props.data);
      },
      
      render: function() {
        var subvars = [
          { value: "capacity", name: "Capacity" },
          { value: "cost", name: "Cost" },
          { value: "iops", name: "IOPS" },
          { value: "riops", name: "Read IOPS" },
          { value: "wiops", name: "Write IOPS" },
          { value: "", name: "Disks" },
        ];
        
        return R(HBlock, {},
                 R(Combo, { value: this.props.data.basevar, options: this.props.extra.variables, onChange: this.onChangeBase }),
                 R(Combo, { value: this.props.data.subvar, options: subvars, onChange: this.onChangeSub })
        );
      }
  });
  
  var Constraint = React.createClass({
      statics: {
        newEmpty: function(extra) {
          return { left: [ Variable.newEmpty(extra) ], op: '>=', right: 100 };
        }
      },

      onChangeLeft: function(data) {
        this.props.data.left = data;
        this.props.onChange(this.props.data);
      },

      onChangeOp: function(data) {
        this.props.data.op = data;
        this.props.onChange(this.props.data);
      },

      onChangeRight: function(data) {
        this.props.data.right = data;
        this.props.onChange(this.props.data);
      },
      
      render: function() {
        var ops = [
          { value: ">=", name: ">=" },
          { value: "=", name: "=" },
          { value: "<=", name: "<=" }
        ];
        
        return R(HBlock, { className: "ss-itembg" },
                 R(List, { className: "ss-inline ss-margin", childClassName: "ss-inline ss-margin",
                           data: this.props.data.left, extra: this.props.extra,
                           itemClass: Variable, onChange: this.onChangeLeft }),
                 R(HBlock, {},
                   R(Combo, { value: this.props.data.op, options: ops, onChange: this.onChangeOp })
                 ),
                 R(HBlock, {},
                   R(TextInput, { value: this.props.data.right, onChange: this.onChangeRight })
                 ),
                 R(SolvedValue, { value: this.props.data.solution, label: "Actual value" })
        );
      }
  });
  
  var Objective = React.createClass({
      onChangeFunc: function(data) {
        this.props.data.func = data;
        this.props.onChange(this.props.data);
      },

      onChangeVars: function(data) {
        this.props.data.vars = data;
        this.props.onChange(this.props.data);
      },
      
      render: function() {
        var funcs = [
          { value: "minimize", label: "Minimize" },
          { value: "maximize", label: "Maximize" }
        ];

        return R('div', {},
                 R(ToggleLabel, { value: this.props.data.func, options: funcs, onChange: this.onChangeFunc }),
                 R(List, { className: "ss-inline ss-margin", childClassName: "ss-inline ss-margin",
                           data: this.props.data.vars, extra: this.props.extra,
                           itemClass: Variable, onChange: this.onChangeVars }),
                 R(SolvedValue, { value: this.props.data.solution, label: "Actual value" })
        );
      }
  });

  var Details = React.createClass({
      render: function() {
				if (this.props.solution === undefined || this.props.solution === null) {
					return null;
				}

				var vars = this.props.solution.variables;
				var rows = [];
				this.props.diskTypes.concat({ varname: "tot" }).forEach(function(dt, i) {
						var cols = [];
						var name = dt.varname === "tot" ? "Total" : dt.varname;
						
						cols.push(R(TD, { key: dt.varname+"name", nonNumeric: true }, name));
						
						[ "", "capacity", "riops", "wiops", "iops", "cost" ].forEach(function(feat) {
								cols.push(R(TD, { key: dt.varname+feat }, vars[dt.varname+feat]))
						});
						
						rows.push(R('tr', { key: dt.varname }, cols));
				});
				
        return R('div', {},
								 R('h4', {}, "Solution details"),
								 R(Table, { className: "ss-center" },
									 R('thead', {},
										 R('tr', {},
											 R(TH, { nonNumeric: true }, ""),
											 R(TH, {}, "Disks"),
											 R(TH, {}, "Capacity"),
											 R(TH, {}, "Read IOPS"),
											 R(TH, {}, "Write IOPS"),
											 R(TH, {}, "IOPS"),
											 R(TH, {}, "Cost")
										 )
									 ),
									 R('tbody', {}, rows)
								 )
				);
      }
  });
  
  /* ENTRYPOINT */
  
  var SolverApp = React.createClass({
			getInitialState: function() {
				return {};
			},

			componentWillReceiveProps: function(props) {
				this.setState({ solverError: null, solution: null });
			},

			componentDidMount: function() {
				var self = this;
				
				window.addEventListener("keyup", function(ev) {
						if (ev.keyCode === 13) { // enter
							self.onSolve();
						}
				});
			},

      onDiskTypes: function(data) {
        this.props.model.diskTypes = data;
				this.props.onChange(this.props.model);
      },

      onConstraints: function(data) {
        this.props.model.constraints = data;
				this.props.onChange(this.props.model);
      },

      onObjective: function(data) {
        this.props.model.objective = data;
				this.props.onChange(this.props.model);
      },

      onSolve: function() {
        var self = this;
        
        var b = new MathProgBuilder();

				// transform GUI structure to MILP problem
				
        var m = this.props.model;
        var vars = {};
        var iops = {};
        var tot = {};
        var subfeat = ["", "cost", "iops", "capacity", "riops", "wiops"];
        subfeat.forEach(function(c) {
            tot[c] = b.lit(0);
        });
        
        m.diskTypes.concat([ { varname: "tot" } ]).forEach(function(dt) {
            vars[dt.varname] = b.createVar(dt.varname).constrain("integer >= 0").access();
            if (dt.varname !== "tot") {
              vars[dt.varname+"groups"] = b.createVar(dt.varname+"groups").constrain("integer >= 0").access();
            }
            vars[dt.varname+"cost"] = b.createVar(dt.varname+"cost").constrain(">= 0").access();
            vars[dt.varname+"capacity"] = b.createVar(dt.varname+"capacity").constrain(">= 0").access();
            vars[dt.varname+"iops"] = b.createVar(dt.varname+"iops").constrain(">= 0").access();
            vars[dt.varname+"riops"] = b.createVar(dt.varname+"riops").constrain(">= 0").access();
            vars[dt.varname+"wiops"] = b.createVar(dt.varname+"wiops").constrain(">= 0").access();

            if (dt.varname !== "tot") {
              subfeat.forEach(function(c) {
                  tot[c] = tot[c].bop("+", vars[dt.varname+c]);
              });
              
              var wpenalty, rpenalty, capacity, group;
							group = dt.raidGroup*dt.raidGroup2;
							
              if (dt.raidType === "none") {
                rpenalty = 1;
                wpenalty = 1;
                capacity = dt.size*group;
							} else if (dt.raidType === "raid5") {
								rpenalty = 1;
								wpenalty = 4;
								capacity = dt.size*(group-1);
              } else if (dt.raidType === "raid6") {
                rpenalty = 1;
                wpenalty = 6;
                capacity = dt.size*(group-2);
              } else if (dt.raidType === "raid10") {
								rpenalty = 1;
								wpenalty = dt.raidGroup;
								capacity = dt.size*dt.raidGroup2;
							}

              var rperc = dt.readRatio/100;
              var wperc = 1-rperc;
              
              var iops = (dt.iops*group) / (wpenalty*wperc + rpenalty*rperc);

              b.addConstraint(vars[dt.varname+"groups"].bop("=", vars[dt.varname].bop("/", b.lit(group))),
                              null, dt.varname+"groups");
              b.addConstraint(vars[dt.varname+"cost"].bop("=", vars[dt.varname].bop("*", b.lit(dt.cost))),
                              null, dt.varname+"cost");
              b.addConstraint(vars[dt.varname+"capacity"].bop("=", vars[dt.varname+"groups"].bop("*", b.lit(capacity))),
                              null, dt.varname+"capacity");
              b.addConstraint(vars[dt.varname+"iops"].bop("=", vars[dt.varname+"groups"].bop("*", b.lit(iops))),
                              null, dt.varname+"iops");
              b.addConstraint(vars[dt.varname+"riops"].bop("=", vars[dt.varname+"groups"].bop("*", b.lit(iops*rperc))),
                              null, dt.varname+"riops");
              b.addConstraint(vars[dt.varname+"wiops"].bop("=", vars[dt.varname+"groups"].bop("*", b.lit(iops*wperc))),
                              null, dt.varname+"wiops");
            }
        });

        subfeat.forEach(function(c) {
            b.addConstraint(vars["tot"+c].bop("=", tot[c]), null, "tot"+c);
        });

        m.constraints.forEach(function(c, i) {
            var left = b.lit(0);
            c.left.forEach(function(v) {
                left = left.bop("+", vars[v.basevar+v.subvar]);
            });
            b.addConstraint(left.bop(c.op, b.lit(c.right)), "user"+i);
        });
        
        var obj = b.lit(0);
        m.objective.vars.forEach(function(v) {
            obj = obj.bop("+", vars[v.basevar+v.subvar]);
        });
        b.setObjective(m.objective.func, obj);

				// build the problem text and solve it
        var probtext = b.build();
        solveMILP(probtext, function(err, solution) {
						var solverError, solution;
            if (err != null) {
              solverError = err;
            } else {
              solution = solution;
            }
            self.setState({ solverError: solverError, solution: solution });
        });
      },

      render: function() {
        var self = this;
        var variables = [
          { value: "tot", name: "Total" }
        ];

        this.props.model.diskTypes.forEach(function(dt, i) {
            variables.push({ value: dt.varname, name: dt.varname });
        });

        var status = { text: "", className: "" };

        var sol = this.state.solution;
        if (sol) {
          var s = {};
          s[GLP_OPT] = { text: "Optimal solution found", className: "ss-green" };
          s[GLP_FEAS] = { text: "Sub-optimal solution found", className: "ss-yellow" };
          s[GLP_INFEAS] = { text: "No good solution found in time", className: "ss-grey" };
          s[GLP_NOFEAS] = { text: "There is no solution to this problem, check your data", className: "ss-red" };
          s[GLP_UNBND] = { text: "Unbounded solution, check your data", className: "ss-red" };
          s[GLP_UNDEF] = { text: "Undefined solution, check your data", className: "ss-red" };
          status = s[sol.status];
        }

        if (sol && (sol.status == GLP_OPT || sol.status == GLP_FEAS || sol.status == GLP_INFEAS)) {
          this.props.model.diskTypes.forEach(function(dt) {
              dt.solution = sol.variables[dt.varname];
          });
          this.props.model.objective.solution = sol.objective;

          this.props.model.constraints.forEach(function(c, i) {
              c.solution = sol.constraints["user"+i];
          });
        } else {
          this.props.model.diskTypes.forEach(function(dt) {
              delete dt.solution;
          });
          this.props.model.constraints.forEach(function(c) {
              delete c.solution;
          });
          delete this.props.model.objective.solution;
        }

        if (this.state.solverError) {
          status = { text: this.state.solverError.toString(), className: "ss-red" };
					console.log(this.state.solverError);
        }

        return R('div', {},
                 R('h4', {}, "Disk types"),
                 R(List, { data: this.props.model.diskTypes, itemClass: DiskType, onChange: this.onDiskTypes }),
                 R('h4', {}, "Constraints"),
                 R(List, { data: this.props.model.constraints, extra: { variables: variables },
                           itemClass: Constraint, onChange: this.onConstraints }),
                 R('h4', {}, "Objective"),
                 R(Objective, { data: this.props.model.objective, extra: { variables: variables },
                                onChange: this.onObjective }),
                 R('hr', {}),
                 R(Button, { raised: true, colored: true, onClick: this.onSolve }, "Solve"),
                 R(HBlock, { className: "ss-solstatus "+status.className }, status.text),
								 R(Details, { diskTypes: this.props.model.diskTypes, solution: this.state.solution })
        );
      }
  });

	/* Manage the app state with browser history */
	
	var HistoryManager = React.createClass({
			getInitialState: function() {
				var hash = window.location.hash;
				if (hash) {
					if (hash[0] === '#') {
						hash = hash.substr(1);
					}

					var state = JSON.parse(atob(hash));
					globalID = state.globalID;
					dtID = state.dtID;
					return { model: state.model };
				} else {
					globalID = 1;
					dtID = 1;
					return { model: getDefaultModel() };
				}
			},
			
			componentWillMount: function() {
				var self = this;
				window.onpopstate = function(ev) {
					if (self.isMounted()) {
						if (ev.state) {
							globalID = ev.state.globalID;
							dtID = ev.state.dtID;
							self.setState({ model: ev.state.model });
						} else {
							globalID = 1;
							dtID = 1;
							self.setState({ model: getDefaultModel() });
						}
					}
				};
			},

			onChange: function(model) {
				// FIXME: make globalID and dtID part of the application model instead of being globals
				var globmodel = { globalID: globalID, dtID: dtID, model: model };
				var hash = "#"+btoa(JSON.stringify(globmodel));
				history.pushState(globmodel, null, hash);
				this.setState({ model: model });
			},
			
			render: function() {
				return R(SolverApp, { model: this.state.model, onChange: this.onChange });
			}
	});
  
  var API = {
    HistoryManager: HistoryManager,
		SolverApp: SolverApp,
		
		start: function(dom) {
      ReactDOM.render(R(HistoryManager), dom);
    }
  };

  return API;

}(React, ReactDOM, componentHandler, MathProgBuilder);
