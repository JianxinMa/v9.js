.global _start
_start:
  li $t0, 0
  li $t1, 0
  li $t2, 0
  li $t3, 0
  li $t4, 0
  li $s0, 0
  li $s1, 0
  li $s2, 0
  li $s3, 0
  li $s4, 0
  li $fp, 0

  li $t1, 0x0  # t1 = 128M - 4M
  lih $t1, 0x07c0  # t1 = 128M - 4M
  addi $sp, $t1, 0

  # call main
  lih $t1, %hi(main)
  addiu  $t1, $t1, %lo(main)
  call  $t1

  # print 'bye'
  li $t0, 0
  li $t1, 0x42
  bout $t0, $t1
  li $t1, 0x79
  bout $t0, $t1
  li $t1, 0x65
  bout $t0, $t1
  li $t1, 0x0a
  bout $t0, $t1
  halt
