# original code from pwntools
# https://github.com/Gallopsled/pwntools/blob/1238fc359eb72313d3f82849b2effdb7063ab429/pwnlib/util/safeeval.py
#
# TL;DR version:
#    Everything in pwntools is open source. Most is under an MIT license, but a
#    few pieces are under GPL or a BSD 2-clause licence.
#
# This license covers everything within this project, except for a few pieces
# of code that we either did not write ourselves or which we derived from code
# that we did not write ourselves. These few pieces have their license specified
# in a header, or by a file called LICENSE.txt, which will explain exactly what
# it covers. The few relevant pieces of code are all contained inside these
# directories:
#
# - pwnlib/constants/
# - pwnlib/data/
#
#
# Copyright (c) 2015 Gallopsled et al.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.

_const_codes = [
    'POP_TOP','ROT_TWO','ROT_THREE','ROT_FOUR','DUP_TOP',
    'BUILD_LIST','BUILD_MAP','BUILD_TUPLE','BUILD_SET',
    'BUILD_CONST_KEY_MAP', 'BUILD_STRING',
    'LOAD_CONST','RETURN_VALUE','STORE_SUBSCR', 'STORE_MAP',
    'LIST_TO_TUPLE', 'LIST_EXTEND', 'SET_UPDATE', 'DICT_UPDATE', 'DICT_MERGE',
    ]

_expr_codes = _const_codes + [
    'UNARY_POSITIVE','UNARY_NEGATIVE','UNARY_NOT',
    'UNARY_INVERT','BINARY_POWER','BINARY_MULTIPLY',
    'BINARY_DIVIDE','BINARY_FLOOR_DIVIDE','BINARY_TRUE_DIVIDE',
    'BINARY_MODULO','BINARY_ADD','BINARY_SUBTRACT',
    'BINARY_LSHIFT','BINARY_RSHIFT','BINARY_AND','BINARY_XOR',
    'BINARY_OR',
    ]

def _get_opcodes(codeobj):
    import dis
    if hasattr(dis, 'get_instructions'):
        return [ins.opcode for ins in dis.get_instructions(codeobj)]
    i = 0
    opcodes = []
    s = codeobj.co_code
    while i < len(s):
        code = s[i]
        opcodes.append(code)
        if code >= dis.HAVE_ARGUMENT:
            i += 3
        else:
            i += 1
    return opcodes


def test_expr(expr, allowed_codes):
    import dis
    allowed_codes = [dis.opmap[c] for c in allowed_codes if c in dis.opmap]
    try:
        c = compile(expr, "", "eval")
    except SyntaxError:
        raise ValueError("%r is not a valid expression" % expr)
    codes = _get_opcodes(c)
    for code in codes:
        if code not in allowed_codes:
            raise ValueError("opcode %s not allowed" % dis.opname[code])
    return c


def expr(expr):
    c = test_expr(expr, _expr_codes)
    return eval(c)


if __name__ == '__main__':
    import sys
    try:
        r = expr(sys.argv[1] if len(sys.argv) == 2 else '')
        if isinstance(r, float) and r.is_integer():
            r = int(r)

        if isinstance(r, int):
            print(f'{r:#d}\n{r:#x}\n{r:#o}\n{r:#b}')
        else:
            print(r)
    except ValueError:
        pass
