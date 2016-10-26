#ifndef __LIBS_RAND_H__
#define __LIBS_RAND_H__

#include <v9.h>
#include <defs.h>

#define RAND_MAX    2147483647

unsigned int next = 1;

/* *
 * rand - returns a pseudo-random integer
 *
 * The rand() function return a value in the range [0, RAND_MAX].
 * */
int
rand(void) {
  unsigned int result, p;
  next = (next * 1592583800 + 11) & ((1 << 32) - 1);
  p = RAND_MAX + 1;
  result = next % p;
  return result;
}

/* *
 * srand - seed the random number generator with the given number
 * @seed:   the required seed number
 * */
void
srand(unsigned int seed) {
  next = seed;
}

#endif
