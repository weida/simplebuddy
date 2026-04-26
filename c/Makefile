CC = gcc
CFLAGS = -g -Wall

default=buddytest  

buddytest: buddy.o buddytest.o	
	$(CC) $(CFLAGS) -o buddytest buddy.o buddytest.o  

buddytest.o: buddytest.c buddy.h list.h
	$(CC) $(CFLAGS) -c buddytest.c
buddy.o: buddy.c buddy.h list.h
	$(CC) $(CFLAGS) -c buddy.c

clean: 
	@rm -rf buddytest *.o *~

