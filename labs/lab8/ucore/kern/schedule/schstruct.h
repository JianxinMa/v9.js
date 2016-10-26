#ifndef __KERN_SCHEDULE_SCHSTRUCT_H__
#define __KERN_SCHEDULE_SCHSTRUCT_H__

#include <list.h>
#include <skew_heap.h>
#include <pstruct.h>

#define MAX_TIME_SLICE 5

// The introduction of scheduling classes is borrrowed from Linux, and makes the
// core scheduler quite extensible. These classes (the scheduler modules) encapsulate
// the scheduling policies.
struct sched_class {
  // the name of sched_class
  char* name;
  // Init the run queue
  void* init;
  // put the proc into runqueue, and this function must be called with rq_lock
  void* enqueue;
  // get the proc out runqueue, and this function must be called with rq_lock
  void* dequeue;
  // choose the next runnable task
  void* pick_next;
  // dealer of the time-tick
  void* proc_tick;
  /* for SMP support in the future
   *  load_balance
   *     void (*load_balance)(struct rq* rq);
   *  get some proc from this rq, used in load_balance,
   *  return value is the num of gotten proc
   *  int (*get_proc)(struct rq* rq, struct proc* procs_moved[]);
   */
};

struct run_queue {
  list_entry_t run_list;
  unsigned int proc_num;
  int max_time_slice;
  // For LAB6 ONLY
  skew_heap_entry_t* lab6_run_pool;
};

// void sched_init(void);
// void wakeup_proc(struct proc_struct *proc);
// void sched_class_proc_tick(struct proc_struct *proc);

#endif /* !__KERN_SCHEDULE_SCHSTRUCT_H__ */
