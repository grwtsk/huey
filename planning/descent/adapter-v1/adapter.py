"""H447-A01: typed comparison adapter, not a theorem about represented events."""
from copy import deepcopy
from fractions import Fraction
import json
from math import factorial


def derivative_step(coefficients):
    """Exact polynomial operation (5-4y)P + 4yP', low degree first."""
    out = [0] * (len(coefficients) + 1)
    for n, a in enumerate(coefficients):
        out[n] += (4*n+5)*a
        out[n+1] -= 4*a
    return tuple(out)


def finite_jet(values, order, convention='raw'):
    if convention != 'raw':
        raise ValueError('raw derivative convention required')
    if type(order) is not int or order < 0 or order >= len(values):
        raise ValueError('requested derivative unavailable; never zero-extend')
    if any(v is None for v in values[:order+1]):
        raise ValueError('unknown is not zero')
    return tuple(values[:order+1])


def taylor_coefficients(raw):
    return tuple(Fraction(v, factorial(n)) for n, v in enumerate(raw))


def determinant(matrix):
    if not matrix:
        return 1
    return sum((-1)**j * matrix[0][j] * determinant(
        [row[:j]+row[j+1:] for row in matrix[1:]]) for j in range(len(matrix)))


def signed_determinant(values, rank, convention='raw'):
    if type(rank) is not int or rank < 0:
        raise ValueError('nonnegative integer rank required')
    if convention != 'raw':
        raise ValueError('convert back from Taylor coefficients first')
    if rank == 0:
        return 1  # Empty determinant; no historical or higher-rank conclusion.
    jet = finite_jet(values, 2*rank-2, convention)
    return (-1)**(rank*(rank-1)//2) * determinant(
        [[jet[i+j] for j in range(rank)] for i in range(rank)])


def formal_use(contract, expected_contract, rank):
    if contract != expected_contract:
        raise ValueError('source, convention, hypothesis, or proof-status drift')
    if type(rank) is not int or not 0 <= rank <= contract['positive_rank_limit']:
        raise ValueError('outside this finite positive-sign contract')
    return deepcopy(contract)


def reading_view(bundle, focus):
    """Change presentation order only. Every assertion/qualification stays visible."""
    records = bundle['records']
    if not focus or len(set(focus)) != len(focus) or any(k not in records for k in focus):
        raise ValueError('unknown or repeated assertion; a copy is not a new witness')
    return {'binding': deepcopy(bundle['binding']), 'focus': list(focus),
            'context': [k for k in records if k not in focus],
            'records': deepcopy(records),
            'source_group_ids': sorted(set(r['source_group_id'] for r in records.values())),
            'independence': 'not established by this adapter'}


def validate_view(view, bundle):
    if view['binding'] != bundle['binding'] or view['records'] != bundle['records']:
        raise ValueError('source assertion, attribution, status, or qualification changed')
    expected = reading_view(bundle, view['focus'])
    if view != expected:
        raise ValueError('omitted context, family drift, or unsupported independence')


def render_view(view, bundle):
    validate_view(view, bundle)
    def line(k):
        r = view['records'][k]
        return f"Record {k}:\n" + json.dumps(r, indent=2, ensure_ascii=False)
    return '\n'.join(['Source binding:', json.dumps(view['binding'], indent=2),
                      'Independence: ' + view['independence'],
                      'Focus:'] + [line(k) for k in view['focus']] +
                     ['Retained context:'] + [line(k) for k in view['context']])


def compare_operations(contract, expected_contract, view, bundle, relation='comparison'):
    """The result is a sourced explanatory pairing, never a historical entailment."""
    if relation != 'comparison':
        raise ValueError('no theorem-to-event implication or algebraic equivalence')
    formal_use(contract, expected_contract, 4)
    validate_view(view, bundle)
    return {'kind': 'proposed_operation_comparison', 'formal': deepcopy(contract),
            'reading': deepcopy(view), 'unproved_connection':
            'No map from historical events or literary order to theta derivative values.'}
