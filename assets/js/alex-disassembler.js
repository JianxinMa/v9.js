var disasm = {
  showAlias: false
};

var parseRegister = function (num) {
  if (disasm.showAlias) {
    var r = ['r0',
      's0', 's1', 's2', 's3', 's4',
      't0', 't1', 't2', 't3', 't4',
      'fp', 'sp', 'gp', 'at', 'lr'][num];
    if (r)
      return r;
    else
      return '??';
  } else {
    return num;
  }
};

var InstrRRR = function (name) {
  return function (inst) {
    var ra = (inst & 0x00F00000) >>> 20;
    var rb = (inst & 0x000F0000) >>> 16;
    var rc = (inst & 0x0000F000) >>> 12;
    return name + ' $' + parseRegister(ra) + ',$' + parseRegister(rb) + ',$' + parseRegister(rc);
  };
};
var InstrRRI = function (name) {
  return function (inst) {
    var ra = (inst & 0x00F00000) >>> 20;
    var rb = (inst & 0x000F0000) >>> 16;
    if (name[name.length - 1] == 'u') {
      return name + ' $' + parseRegister(ra) + ',$' + parseRegister(rb) + ',0x' + (inst & 0x0000FFFF).toString(16);
    }
    else {
      return name + ' $' + parseRegister(ra) + ',$' + parseRegister(rb) + ',' + ((inst & 0x0000FFFF) << 16 >> 16);
    }
  };
};
var InstrRR = function (name) {
  return function (inst) {
    var ra = (inst & 0x00F00000) >>> 20;
    var rb = (inst & 0x000F0000) >>> 16;
    return name + ' $' + parseRegister(ra) + ',$' + parseRegister(rb);
  };
};
var InstrRI = function (name) {
  return function (inst) {
    var ra = (inst & 0x00F00000) >>> 20;
    if (name[name.length - 1] == 'u')
      return name + ' $' + parseRegister(ra) + ',0x' + (inst & 0xFFFF).toString(16);
    else
      return name + ' $' + parseRegister(ra) + ',' + ((inst & 0x0000FFFF) << 16 >> 16);
  };
};
var InstrR = function (name) {
  return function (inst) {
    var ra = (inst & 0x00F00000) >>> 20;
    return name + ' $' + parseRegister(ra);
  };
};
var InstrI = function (name) {
  return function (inst) {
    if (name[name.length - 1] == 'u')
      return name + ' 0x' + (inst & 0xFFFF).toString(16);
    else
      return name + ' ' + ((inst & 0x0000FFFF) << 16 >> 16);
  };
};

var instructions = {
  0x1: InstrRRR('add'),
  0x2: InstrRRI('addi'),
  0x3: InstrRRI('addiu'),
  0x4: InstrRRR('sub'),
  0x5: InstrRRI('subi'),
  0x6: InstrRRI('subiu'),
  0x7: InstrRRR('mul'),
  0x8: InstrRRI('muli'),
  0x9: InstrRRI('muliu'),
  0xa: InstrRRR('div'),
  0xb: InstrRRI('divi'),
  0xc: InstrRRI('diviu'),
  0x43: InstrRRR('divu'),
  0xd: InstrRRR('mod'),
  0xe: InstrRRI('modi'),
  0xf: InstrRRI('modiu'),
  0x44: InstrRRR('modu'),
  0x10: InstrRRR('shl'),
  0x11: InstrRRI('shli'),
  0x12: InstrRRR('slr'),
  0x13: InstrRRI('slri'),
  0x14: InstrRRR('sar'),
  0x15: InstrRRI('sari'),
  0x16: InstrRRR('and'),
  0x17: InstrRRR('or'),
  0x42: InstrRRI('ori'),
  0x18: InstrRRR('xor'),
  0x19: InstrRR('not'),
  0x1a: InstrRRR('eq'),
  0x1b: InstrRRR('ne'),
  0x1c: InstrRRR('lt'),
  0x1d: InstrRRR('ltu'),
  0x1e: InstrRRR('gt'),
  0x1f: InstrRRR('gtu'),
  0x20: InstrRRR('le'),
  0x21: InstrRRR('leu'),
  0x22: InstrRRR('ge'),
  0x23: InstrRRR('geu'),
  0x24: InstrI('b'),
  0x25: InstrRRI('beq'),
  0x26: InstrRRI('bne'),
  0x27: InstrRRI('blt'),
  0x28: InstrRRI('bgt'),
  0x2a: InstrR('jr'),
  0x2b: InstrR('call'),
  0x2c: function () {
    return 'ret';
  },
  0x2d: InstrRRI('lw'),
  0x2e: InstrRRI('lh'),
  0x2f: InstrRRI('lb'),
  0x31: InstrRI('li'),
  0x32: InstrRI('liu'),
  0x33: InstrRI('lih'),
  0x34: InstrRRI('sw'),
  0x35: InstrRRI('sh'),
  0x36: InstrRRI('sb'),
  0x38: InstrR('popw'),
  0x39: InstrR('poph'),
  0x3a: InstrR('popb'),
  0x3c: InstrR('popa'),
  0x3d: InstrR('pshw'),
  0x3e: InstrR('pshh'),
  0x3f: InstrR('pshb'),
  0x41: InstrR('psha'),
  0x80: InstrRR('bin'),
  0x81: InstrRR('bout'),
  0x82: InstrR('mfiv'),
  0x83: InstrR('mtiv'),
  0x84: InstrR('mfpt'),
  0x85: InstrR('mtpt'),
  0x86: InstrR('lflg'),
  0x88: InstrR('lvad'),
  0x89: InstrR('time'),
  0xf0: InstrR('trap')
};

disasm.disassemble = function (inst, showAlias) {
  disasm.showAlias = showAlias || true;
  var opcode = inst >>> 24;
  var machineCode = inst.toString(16);

  if (inst == 0xffffffff)
    return machineCode + ' halt';
  else if (instructions[opcode])
    return machineCode + ' ' + instructions[opcode](inst);
  else
    return machineCode + ' unknown';
};