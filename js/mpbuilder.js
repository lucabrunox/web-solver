MathProgBuilder = function() {

	/* COMPOUND EXPRESSION */
	var Expr = function(op, operands) {
		this.op = op;
		this.operands = operands;
	};

	Expr.prototype = {
		uop: function(op) {
			return new Expr(op, [this]);
		},
		
		bop: function(op, expr) {
			return new Expr(op, [this, expr]);
		},

		buildExpr: function() {
			if (this.operands.length == 1) {
				return this.op+" ("+this.operands[0].buildExpr()+")";
			} else {
				return this.operands[0].buildExpr()+" "+this.op+" "+this.operands[1].buildExpr();
			}
		}
	};

	/* LITERAL */
	var Literal = function(val) {
		this.val = val;
	};

	Literal.prototype = {
		buildExpr: function() {
			return ""+this.val;
		},

		expr: function() {
			return new Expr("", [this]);
		},
	};		

	/* VARIABLE */
	var Var = function(id, comment) {
		this.id = id;
		this.comment = comment;
		this.constraint = "";
	};
	
	Var.prototype = {
		constrain: function(c) {
			this.constraint = c;
			return this;
		},

		definition: function() {
			return "var "+this.id+" "+this.constraint;
		},

		buildExpr: function() {
			return this.id;
		},
	
		access: function() {
			return new Expr("", [this]);
		},
	};

	/* BUILDER */
  var Builder = function() {
		this.varId = 0;
		this.vars = [];
		this.constraints = [];
		this.func = "maximize";
		this.objective = this.lit(0);
	};

	Builder.prototype = {
		createVar: function(id, comment) {
			var varId = id || ("x"+this.varId++);
			var v = new Var(varId, comment);
			this.vars.push(v);
			return v;
		},

		lit: function(val) {
			return (new Literal(val)).expr();
		},

		addConstraint: function(expr, name, comment) {
			this.constraints.push({ comment: comment, name: name, expr: expr });
			return this;
		},

		setObjective: function(func, expr) {
			this.func = func;
			this.objective = expr;
			return this;
		},

		build: function() {
			var prob = "";
			this.vars.forEach(function(v) {
					if (v.comment) {
						prob += "/* "+v.comment+" */\n";
					}
					prob += v.definition()+';\n';
			});

			prob += this.func+" f: "+this.objective.buildExpr()+';\n';
			
			this.constraints.forEach(function(c, i) {
					if (c.comment) {
						prob += "/* "+c.comment+" */\n";
					}
					var conId = c.name || "c"+i;
					prob += conId+": "+c.expr.buildExpr()+";\n";
			});
			
			prob += "solve; end;\n";
			
			return prob;
		},
	};

  return Builder;

}();
