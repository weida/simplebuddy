#include <stdio.h>
#include "list.h"
#include "buddy.h"


unsigned int
get_order (unsigned int size)
{

  unsigned int memsize = size;
  unsigned int order = 0;
  while (memsize >>= 6) {
     ++order;
  }
  return order;
}


int
main ()
{

  unsigned int orderA;
  unsigned int memsizeA;
  struct page *pageA, *pageB, *pageC, *pageD;
  unsigned long pfn;

  free_area_init_core();
  print_free_area_head();
  print_free_area(1);

  print_free_area(2);
// Program A  requests memory 34 K, order 0
  memsizeA = 34;
  orderA = get_order (memsizeA);
  pageA = alloc_pages (orderA);
  pageA->process.pid = 'A';
  pageA->process.private = orderA;
  print_free_area(2);

  print_free_area(3);
// Program B  requests memory 66 K, order 1.
  unsigned int orderB;
  unsigned int memsizeB;

  memsizeB = 66;
  orderB = get_order (memsizeB);
  pageB = alloc_pages (orderB);
  
  pageB->process.pid = 'B';
  pageB->process.private = orderB;
  print_free_area(3);

  print_free_area(4);
// Program C  requests memory 35 K, order 1.
  unsigned int orderC;
  unsigned int memsizeC;

  memsizeC = 35;
  orderC = get_order (memsizeC);
  pageC = alloc_pages (orderC);

  pageC->process.pid = 'C';
  pageC->process.private = orderC;
  print_free_area(4);

  print_free_area(5);
// Program D  requests memory 67 K, order 1.
  unsigned int orderD;
  unsigned int memsizeD;

  memsizeD = 67;
  orderD = get_order (memsizeD);
  pageD = alloc_pages (orderD);
  pageD->process.pid = 'D';
  pageD->process.private = orderD;
  print_free_area(5);


   print_free_area(6);
// Program B  release memory 
   free_page(pageB, orderB);
   pageB->process.pid = 0;
   print_free_area(6);

   print_free_area(7);
// Program D  release memory 
   pageD->process.pid = 0;
   free_page(pageD, orderD);
   print_free_area(7);

   print_free_area(8);
// Program A  release memory 
   pageA->process.pid = 0;
   free_page(pageA, orderA);
   print_free_area(8);

   print_free_area(9);
// Program C  release memory 
   pageC->process.pid = 0;
   free_page(pageC, orderC);
   print_free_area(9);
}
