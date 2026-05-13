import React from 'react'

function loginPage() {
  return (
    <div className='flex bg-gradient min-h-screen select-none items-center justify-center'>
        <div className='flex flex-col gap-12.5'>
            <img src='/VotelyNew_White.png' className='h-[53px]'></img>
            <div className='flex flex-col bg-white border border-white p-8 rounded-lg items-center  gap-8'>
                <div className=' items-center text-center'>
                    <img src='/userlogo.png' className='w-20 h-20'>
                    </img>
                    <div className='font-black font-google text-3xl'>
                        Login
                    </div>
                </div>

                <div className='flex flex-col w-full gap-3'>
                    <div className='flex flex-row bg-[#E7E9F0] rounded-xl justify-between p-2 px-5'>
                        <input
                            type='email'
                            placeholder='Email'
                            className='font-google text-sm outline-none focus:outline-none'
                        />
                        {/* <img src='/userlogo.png' className='h-5'/> */}
                    </div>
                    <div className='flex flex-row bg-[#E7E9F0] rounded-xl justify-between p-2 px-5'>
                        <input
                            type='password'
                            placeholder='Password'
                            className='font-google text-sm outline-none focus:outline-none'
                        />
                    </div>
                </div>


                <div className='flex flex-col w-full gap-3 items-center'>
                    <button className='w-full bg-[#82A8D1] font-bold text-white p-2 rounded-xl hover:scale-105 cursor-pointer duration-200'>
                        Login
                    </button>
                    <div className='gap-1.5 w-full text-center'>
                        <p className='text-sm'>
                            Having some trouble while logging in?
                        </p>
                        <p className='text-sm font-bold text-[#3167A9]'>
                            Get Help Logged In
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  )
}

export default loginPage